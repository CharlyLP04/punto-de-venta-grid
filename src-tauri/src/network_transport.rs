// One HTTPS request per connection. Bounded admission and socket deadlines apply
// before authentication too, including TLS handshakes and partial request bodies.
use crate::{err, Result, Store};
use rustls::{pki_types::{pem::PemObject, CertificateDer, PrivateKeyDer}, ServerConfig, ServerConnection, StreamOwned};
use serde_json::{json, Value};
use std::{io::{self, BufRead, BufReader, Read, Write}, net::{TcpListener,TcpStream}, sync::{Arc,Mutex,mpsc}, time::{Duration,Instant}};
use tauri::Manager;

const BODY_LIMIT: usize=48*1024*1024;
const HEADER_LIMIT: usize=8192;
struct DeadlineSocket { stream:TcpStream, deadline:Instant }
impl DeadlineSocket {
    fn timeout(&self)->io::Result<Duration> {
        let left=self.deadline.saturating_duration_since(Instant::now());
        if left.is_zero(){Err(io::Error::new(io::ErrorKind::TimedOut,"Tiempo de conexión agotado"))}
        else{Ok(left.min(Duration::from_secs(5)))}
    }
}
impl Read for DeadlineSocket {
    fn read(&mut self,bytes:&mut [u8])->io::Result<usize>{
        self.stream.set_read_timeout(Some(self.timeout()?))?;
        self.stream.read(bytes)
    }
}
impl Write for DeadlineSocket {
    fn write(&mut self,bytes:&[u8])->io::Result<usize>{
        self.stream.set_write_timeout(Some(self.timeout()?))?;
        self.stream.write(bytes)
    }
    fn flush(&mut self)->io::Result<()>{self.stream.flush()}
}
type TlsStream=StreamOwned<ServerConnection,DeadlineSocket>;

pub fn start(app:tauri::AppHandle,address:&str,certificate:&[u8],key:&[u8])->Result<()> {
    let certs=CertificateDer::pem_slice_iter(certificate).collect::<std::result::Result<Vec<_>,_>>().map_err(err)?;
    let key=PrivateKeyDer::from_pem_slice(key).map_err(err)?;
    let config=ServerConfig::builder_with_provider(Arc::new(rustls::crypto::ring::default_provider()))
        .with_safe_default_protocol_versions().map_err(err)?
        .with_no_client_auth().with_single_cert(certs,key).map_err(err)?;
    let config=Arc::new(config);
    let listener=TcpListener::bind(format!("{}:47831",address)).map_err(err)?;
    listener.set_nonblocking(true).map_err(err)?;
    let (sender,receiver)=mpsc::sync_channel::<DeadlineSocket>(8);
    let receiver=Arc::new(Mutex::new(receiver));
    for _ in 0..4 {
        let receiver=receiver.clone();let app=app.clone();let config=config.clone();
        std::thread::spawn(move||loop {
            let socket=match receiver.lock(){Ok(rx)=>rx.recv(),Err(_)=>return};
            let Ok(socket)=socket else{return};
            let Ok(_operation)=crate::lifecycle::enter() else{continue};
            let Ok(connection)=ServerConnection::new(config.clone()) else{continue};
            serve(&app,StreamOwned::new(connection,socket));
        });
    }
    std::thread::spawn(move||loop {
        if crate::lifecycle::closing(){std::thread::sleep(Duration::from_millis(50));continue;}
        match listener.accept(){
            Ok((stream,_))=>{
                // Overflow closes the connection; no unbounded per-client thread.
                let _=sender.try_send(DeadlineSocket{stream,deadline:Instant::now()+Duration::from_secs(20)});
            }
            Err(error) if error.kind()==io::ErrorKind::WouldBlock=>std::thread::sleep(Duration::from_millis(20)),
            Err(_)=>return,
        }
    });
    Ok(())
}

fn request(reader:&mut BufReader<TlsStream>,store:&Store)->Result<(String,Value)> {
    let mut headers=String::new();
    loop {
        let mut line=String::new();
        let capacity=HEADER_LIMIT.saturating_sub(headers.len());
        let count=reader.by_ref().take((capacity+1) as u64).read_line(&mut line).map_err(err)?;
        if count==0||count>capacity{return Err("Encabezado incompleto o demasiado grande".into());}
        headers.push_str(&line);
        if line=="\r\n"{break;}
        if !line.ends_with("\r\n"){return Err("Encabezado inválido".into());}
    }
    let mut lines=headers.split("\r\n");
    if lines.next()!=Some("POST /rpc HTTP/1.1"){return Err("Ruta no disponible".into());}
    let mut key=None;let mut length=None;
    for line in lines.filter(|line|!line.is_empty()) {
        let (name,value)=line.split_once(':').ok_or("Encabezado inválido")?;
        if name.eq_ignore_ascii_case("transfer-encoding"){return Err("Indica el tamaño de la solicitud".into());}
        if name.eq_ignore_ascii_case("content-length") {
            if length.is_some(){return Err("Tamaño duplicado".into());}
            let size=value.trim().parse::<usize>().map_err(|_|"Tamaño inválido")?;
            if size==0||size>BODY_LIMIT{return Err("Solicitud demasiado grande o vacía".into());}
            length=Some(size);
        }
        if name.eq_ignore_ascii_case("authorization") {
            if key.is_some(){return Err("Autorización duplicada".into());}
            key=Some(value.trim().strip_prefix("Bearer ").ok_or("Caja no vinculada")?.to_owned());
        }
    }
    let key=key.ok_or("Caja no vinculada")?;
    {
        let db=store.db.lock().map_err(err)?;
        db.query_row("SELECT id FROM registers WHERE token=? AND enabled=1",[&key],|r|r.get::<_,i64>(0)).map_err(|_|"Caja no vinculada")?;
    }
    let mut bytes=vec![0;length.ok_or("Falta el tamaño de la solicitud")?];
    reader.read_exact(&mut bytes).map_err(err)?;
    let input:Value=serde_json::from_slice(&bytes).map_err(err)?;
    if bytes.len()>256*1024&&!matches!(input["command"].as_str(),Some("catalog_preview"|"catalog_apply")) {
        return Err("Solicitud demasiado grande para esta operación".into());
    }
    Ok((key,input))
}
fn serve(app:&tauri::AppHandle,stream:TlsStream) {
    let mut reader=BufReader::new(stream);
    let store=app.state::<Store>();
    let response=request(&mut reader,&store).and_then(|(key,input)|{
        crate::network::process(&store,&key,input["command"].as_str().ok_or("Comando inválido")?,input["args"].clone())
    });
    let body=match response{Ok(value)=>json!({"ok":value}),Err(error)=>json!({"error":error})}.to_string();
    // Body/handshake deadline is independent of service execution and reply time.
    reader.get_mut().sock.deadline=Instant::now()+Duration::from_secs(5);
    let stream=reader.get_mut();
    let header=format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",body.len());
    let _=stream.write_all(header.as_bytes()).and_then(|_|stream.write_all(body.as_bytes())).and_then(|_|stream.flush());
}
