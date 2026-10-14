use crate::{err,security,Result,Store};
use rusqlite::{params,Connection};
use serde::{Deserialize,Serialize};
use serde_json::{json,Value};
use std::{cell::Cell,io::Read,sync::{Mutex,OnceLock},time::Duration};
use tauri::{Manager,State};
thread_local! {static REGISTER:Cell<i64>=const {Cell::new(1)};}
pub fn register()->i64{REGISTER.with(Cell::get)}
pub fn at_register<T>(id:i64,f:impl FnOnce()->T)->T{
    struct Restore(i64);impl Drop for Restore{fn drop(&mut self){REGISTER.with(|c|c.set(self.0));}}
    let old=REGISTER.with(|c|c.replace(id));let _restore=Restore(old);f()
}
pub fn migrate(db:&mut Connection)->Result<()>{
    let version:i64=db.query_row("PRAGMA user_version",[],|r|r.get(0)).map_err(err)?;if version>=7{return Ok(());}
    let tx=db.transaction().map_err(err)?;
    tx.execute_batch("CREATE TABLE registers(id INTEGER PRIMARY KEY,name TEXT NOT NULL,token TEXT UNIQUE,enabled INTEGER NOT NULL DEFAULT 1);
    INSERT INTO registers(id,name) VALUES(1,'Caja principal');
    ALTER TABLE shifts ADD COLUMN register_id INTEGER NOT NULL DEFAULT 1 REFERENCES registers(id);
    DROP INDEX IF EXISTS one_open_shift;
    CREATE UNIQUE INDEX one_open_shift_per_register ON shifts(register_id) WHERE closed IS NULL;
    CREATE TABLE cart_network(ticket INTEGER NOT NULL CHECK(ticket BETWEEN 1 AND 5000),product INTEGER NOT NULL REFERENCES products(id),quantity INTEGER NOT NULL,override_price INTEGER,reason TEXT,discount_authorized_by INTEGER REFERENCES users(id),PRIMARY KEY(ticket,product));
    INSERT INTO cart_network SELECT ticket,product,quantity,override_price,reason,discount_authorized_by FROM cart;
    DROP TABLE cart;ALTER TABLE cart_network RENAME TO cart;
    CREATE TABLE common_network(id INTEGER PRIMARY KEY AUTOINCREMENT,ticket INTEGER NOT NULL CHECK(ticket BETWEEN 1 AND 5000),name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 1000000),price INTEGER NOT NULL CHECK(price BETWEEN 1 AND 100000000),cost INTEGER CHECK(cost BETWEEN 0 AND 100000000));
    INSERT INTO common_network SELECT * FROM common_cart;DROP TABLE common_cart;ALTER TABLE common_network RENAME TO common_cart;
    CREATE TABLE fiscal_documents(id TEXT PRIMARY KEY,sale TEXT NOT NULL UNIQUE REFERENCES sales(id),payload TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'draft',provider_id TEXT,uuid TEXT,response TEXT,created TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
    PRAGMA user_version=7;") .map_err(err)?;tx.commit().map_err(err)
}
#[derive(Serialize,Deserialize,Clone)]
pub struct Pairing{url:String,certificate:String,token:String,name:String}
static SERVER:OnceLock<Mutex<Option<(String,String)>>>=OnceLock::new();
fn running()->&'static Mutex<Option<(String,String)>>{SERVER.get_or_init(||Mutex::new(None))}
pub fn client(certificate:&str)->Result<reqwest::blocking::Client>{
    reqwest::blocking::Client::builder().no_proxy().tls_built_in_root_certs(false).add_root_certificate(reqwest::Certificate::from_pem(certificate.as_bytes()).map_err(err)?).redirect(reqwest::redirect::Policy::none()).connect_timeout(Duration::from_secs(4)).timeout(Duration::from_secs(45)).build().map_err(err)
}
pub fn process(store:&Store,key:&str,command:&str,args:Value)->Result<Value>{
    let id:i64={let db=store.db.lock().map_err(err)?;db.query_row("SELECT id FROM registers WHERE token=? AND enabled=1",[key],|r|r.get(0)).map_err(|_|"Caja no vinculada")?};
    at_register(id,||crate::rpc::dispatch(store,command,args))
}
#[tauri::command]
pub fn network_start(app:tauri::AppHandle,store:State<Store>,session_token:String,address:String)->Result<Value>{
    {let db=store.db.lock().map_err(err)?;security::authorize(&store,&db,&session_token,"settings.manage")?;}
    let ip:std::net::Ipv4Addr=address.parse().map_err(|_|"Escribe la dirección IPv4 de esta computadora")?;
    if !(ip.is_private()||ip.is_loopback()){return Err("Solo se permite una dirección de red local".into());}
    let mut current=running().lock().map_err(err)?;if current.is_some(){return Err("El servidor ya está iniciado; reinicia la aplicación para cambiar la dirección".into());}
    let cert_path=store.directory.join("multicaja-cert.pem");let key_path=store.directory.join("multicaja-key.pem");
    let host_path=store.directory.join("multicaja-host.txt");
    if !cert_path.exists()||!key_path.exists()||std::fs::read_to_string(&host_path).unwrap_or_default()!=address{
        let cert=rcgen::generate_simple_self_signed(vec![address.clone()]).map_err(err)?;
        std::fs::write(&cert_path,cert.cert.pem()).map_err(err)?;std::fs::write(&key_path,cert.key_pair.serialize_pem()).map_err(err)?;std::fs::write(host_path,&address).map_err(err)?;
    }
    let certificate=std::fs::read_to_string(cert_path).map_err(err)?;
    let server=tiny_http::Server::https(format!("{}:47831",address),tiny_http::SslConfig{certificate:certificate.as_bytes().to_vec(),private_key:std::fs::read(key_path).map_err(err)?}).map_err(err)?;
    let url=format!("https://{}:47831",address);*current=Some((url.clone(),certificate));
    // A bounded pool keeps a slow fiscal request from blocking the cash registers.
    let (sender,receiver)=std::sync::mpsc::sync_channel::<tiny_http::Request>(8);
    let receiver=std::sync::Arc::new(Mutex::new(receiver));
    for _ in 0..4 {let receiver=receiver.clone();let handle=app.clone();std::thread::spawn(move||loop{
        let request={match receiver.lock(){Ok(lock)=>lock.recv(),Err(_)=>return}};
        match request{Ok(request)=>serve_request(&handle,request),Err(_)=>return}
    });}
    std::thread::spawn(move||for request in server.incoming_requests(){
        if let Err(std::sync::mpsc::TrySendError::Full(request))=sender.try_send(request){let _=request.respond(tiny_http::Response::from_string("Servidor ocupado; intenta de nuevo").with_status_code(503));}
    });
    Ok(json!({"url":url}))
}
#[tauri::command]
pub fn network_pair(store:State<Store>,session_token:String,name:String)->Result<Value>{
    if name.trim().is_empty()||name.len()>60{return Err("Escribe un nombre de caja de hasta 60 caracteres".into());}
    let (url,certificate)=running().lock().map_err(err)?.clone().ok_or("Inicia el servidor primero")?;
    let db=store.db.lock().map_err(err)?;let actor=security::authorize(&store,&db,&session_token,"settings.manage")?;
    let max:i64=db.query_row("SELECT max(id) FROM registers",[],|r|r.get(0)).map_err(err)?;if max>=1000{return Err("Límite de cajas alcanzado".into());}
    let token=format!("{}{}",uuid::Uuid::new_v4(),uuid::Uuid::new_v4());
    db.execute("INSERT INTO registers(name,token) VALUES(?,?)",params![name,token]).map_err(err)?;
    security::audit(&db,actor.id,json!({"type":"register.created","message":"Se vinculó una caja de la red local","name":name}))?;
    Ok(json!(Pairing{url,certificate,token,name}))
}
#[tauri::command]
pub fn network_registers(store:State<Store>,session_token:String,id:Option<i64>,enabled:Option<bool>)->Result<Value>{
    let db=store.db.lock().map_err(err)?;let actor=security::authorize(&store,&db,&session_token,"settings.manage")?;
    if let Some(id)=id{
        if id<=1{return Err("La caja principal no se puede desactivar".into());}
        let enabled=enabled.ok_or("Indica si la caja debe estar activa")?;
        db.execute("UPDATE registers SET enabled=? WHERE id=?",params![enabled,id]).map_err(err)?;
        store.sessions.lock().map_err(err)?.retain(|_,(_,_,register)|*register!=id);
        security::audit(&db,actor.id,json!({"type":"register.changed","message":if enabled{"Se habilitó una caja de la red"}else{"Se bloqueó el acceso de una caja de la red"},"target_register":id}))?;
    }
    Ok(json!(crate::rows(&db,"SELECT id,name,enabled FROM registers ORDER BY id")?))
}
#[tauri::command]
pub fn connection_status(store:State<Store>)->Result<Value>{
    let remote=std::fs::read_to_string(store.directory.join("connection.json")).ok().and_then(|s|serde_json::from_str::<Pairing>(&s).ok());
    Ok(json!({"remote":remote.is_some(),"name":remote.as_ref().map(|r|r.name.as_str()).unwrap_or("Caja principal"),"url":remote.map(|r|r.url),"serving":running().lock().map_err(err)?.is_some()}))
}
#[tauri::command]
pub fn connection_save(store:State<Store>,pairing:Option<Pairing>)->Result<()>{
    // Connection changes are allowed only when logged out, before any credentials are entered.
    if !store.sessions.lock().map_err(err)?.is_empty(){return Err("Cierra sesión antes de cambiar de conexión".into());}
    let path=store.directory.join("connection.json");
    if let Some(value)=pairing{
        let url=reqwest::Url::parse(&value.url).map_err(err)?;
        let ip=url.host_str().and_then(|h|h.parse::<std::net::Ipv4Addr>().ok()).ok_or("Dirección local inválida")?;
        if url.scheme()!="https"||!(ip.is_private()||ip.is_loopback())||url.port()!=Some(47831)||!url.username().is_empty()||url.password().is_some()||url.path()!="/"||url.query().is_some()||url.fragment().is_some()||value.token.len()>100||value.token.len()<60||value.certificate.len()>10000{return Err("Datos de vinculación inválidos".into());}
        reqwest::Certificate::from_pem(value.certificate.as_bytes()).map_err(err)?;
        std::fs::write(path,serde_json::to_vec(&value).map_err(err)?).map_err(err)?;
    }else if path.exists(){std::fs::remove_file(path).map_err(err)?;}
    Ok(())
}
#[tauri::command]
pub async fn connection_call(app:tauri::AppHandle,command:String,args:Value)->Result<Value>{
    tauri::async_runtime::spawn_blocking(move||{
        let store=app.state::<Store>();
        let path=store.directory.join("connection.json");
        if !path.exists(){return crate::rpc::dispatch(&store,&command,args);}
        let config:Pairing=serde_json::from_slice(&std::fs::read(path).map_err(err)?).map_err(err)?;
        let client=client(&config.certificate)?;
        let response:Value=client.post(format!("{}/rpc",config.url.trim_end_matches('/'))).bearer_auth(config.token).json(&json!({"command":command,"args":args})).send().map_err(|_|"No se pudo conectar con la caja principal. No se guardará una venta local; comprueba la conexión antes de reintentar.".to_string())?.json().map_err(err)?;
        if let Some(error)=response["error"].as_str(){Err(error.into())}else if response.get("ok").is_some(){Ok(response["ok"].clone())}else{Err("Respuesta inválida de la caja principal".into())}
    }).await.map_err(err)?
}

fn serve_request(app:&tauri::AppHandle,mut request:tiny_http::Request){
        let response=(||->Result<Value>{
            if request.method()!=&tiny_http::Method::Post||request.url()!="/rpc"{return Err("Ruta no disponible".into());}
            let key=request.headers().iter().find(|h|h.field.equiv("Authorization")).map(|h|h.value.as_str().trim_start_matches("Bearer ").to_owned()).ok_or("Caja no vinculada")?;
            let store=app.state::<Store>();
            {let db=store.db.lock().map_err(err)?;db.query_row("SELECT id FROM registers WHERE token=? AND enabled=1",[&key],|r|r.get::<_,i64>(0)).map_err(|_|"Caja no vinculada")?;}
            let mut body=String::new();request.as_reader().take(48*1024*1024+1).read_to_string(&mut body).map_err(err)?;
            if body.len()>48*1024*1024{return Err("Solicitud demasiado grande".into());}
            let input:Value=serde_json::from_str(&body).map_err(err)?;
            process(&store,&key,input["command"].as_str().ok_or("Comando inválido")?,input["args"].clone())
        })();
        let body=match response{Ok(value)=>json!({"ok":value}),Err(error)=>json!({"error":error})};
        let _=request.respond(tiny_http::Response::from_string(body.to_string()).with_header(tiny_http::Header::from_bytes("Content-Type","application/json").unwrap()));
}
