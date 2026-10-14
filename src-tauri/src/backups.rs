use crate::{err,security,setting,Result,Store};
use rusqlite::{params,Connection,DatabaseName,OpenFlags};
use serde_json::{json,Value};
use std::path::{Path,PathBuf};
use tauri::State;

static MAINTENANCE: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[tauri::command]
pub fn backup_retention(store:State<Store>,session_token:String,keep:i64)->Result<()> {
    if ![0,7,30,90].contains(&keep){return Err("Retención inválida".into());}
    let db=store.db.lock().map_err(err)?;
    let actor=security::authorize(&store,&db,&session_token,"backup.create")?;
    db.execute("INSERT INTO settings(key,value) VALUES('backup_keep',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[keep.to_string()]).map_err(err)?;
    security::audit(&db,actor.id,json!({"type":"backup.retention","keep":keep}))
}

fn retain_automatic(directory:&Path,keep:usize)->Result<()> {
    if keep==0{return Ok(());}
    let root=directory.join("respaldos").canonicalize().map_err(err)?;
    let mut copies=Vec::new();
    for entry in std::fs::read_dir(&root).map_err(err)? {
        let entry=entry.map_err(err)?;
        let name=entry.file_name().to_string_lossy().into_owned();
        if entry.file_type().map_err(err)?.is_file()&&(name.starts_with("grid-auto-")||name.starts_with("mario-auto-"))&&name.ends_with(".sqlite") {
            copies.push((entry.metadata().map_err(err)?.modified().map_err(err)?,entry.path()));
        }
    }
    copies.sort_by(|a,b|b.0.cmp(&a.0));
    for (_,path) in copies.into_iter().skip(keep) {
        let resolved=path.canonicalize().map_err(err)?;
        if resolved.parent()!=Some(root.as_path()){return Err("Copia fuera de la carpeta autorizada".into());}
        std::fs::remove_file(resolved).map_err(err)?;
    }
    Ok(())
}

#[tauri::command]
pub fn export_backup(store:State<Store>,session_token:String,name:String,destination:String)->Result<String>{
    let _maintenance=MAINTENANCE.lock().map_err(err)?;
    let actor={let db=store.db.lock().map_err(err)?;security::authorize(&store,&db,&session_token,"backup.create")?};
    if name.contains(['/', '\\', ':'])||(!name.starts_with("grid-")&&!name.starts_with("mario-"))||!name.ends_with(".sqlite"){return Err("Selecciona un respaldo válido".into());}
    let root=store.directory.join("respaldos").canonicalize().map_err(err)?;
    let source=root.join(&name).canonicalize().map_err(err)?;
    if source.parent()!=Some(root.as_path()){return Err("Respaldo fuera de la carpeta autorizada".into());}
    let directory=PathBuf::from(destination.trim()).canonicalize().map_err(err)?;
    if !directory.is_dir()||directory==root{return Err("Elige otra carpeta existente, por ejemplo una memoria USB".into());}
    let target=directory.join(format!("grid-export-{}.sqlite",uuid::Uuid::new_v4()));
    let mut input=std::fs::File::open(source).map_err(err)?;
    let mut output=std::fs::OpenOptions::new().write(true).create_new(true).open(&target).map_err(err)?;
    std::io::copy(&mut input,&mut output).map_err(err)?;output.sync_all().map_err(err)?;
    let db=store.db.lock().map_err(err)?;
    security::audit(&db,actor.id,json!({"type":"backup.exported","source":name,"destination":target.to_string_lossy()}))?;
    Ok(target.to_string_lossy().into_owned())
}

pub fn create(db:&Connection,directory:&Path,kind:&str)->Result<PathBuf>{
    let root=directory.join("respaldos");std::fs::create_dir_all(&root).map_err(err)?;
    let stamp:String=db.query_row("SELECT strftime('%Y%m%d-%H%M%S','now','localtime')",[],|r|r.get(0)).map_err(err)?;
    let target=root.join(format!("grid-{}-{}-{}.sqlite",kind,stamp,uuid::Uuid::new_v4()));
    let pending=target.with_extension("partial");
    db.backup(DatabaseName::Main,&pending,None).map_err(err)?;
    std::fs::rename(&pending,&target).map_err(err)?;Ok(target)
}
pub fn automatic(store:&Store)->Result<()> {
    let _maintenance=MAINTENANCE.lock().map_err(err)?;
    let db=store.db.lock().map_err(err)?;
    let owners:i64=db.query_row("SELECT count(*) FROM users WHERE role='owner' AND enabled=1",[],|r|r.get(0)).map_err(err)?;
    if owners==0{return Ok(());}
    let hours=setting(&db,"backup_hours","24").parse::<i64>().unwrap_or(24);
    if hours==0{return Ok(());}
    let now:i64=db.query_row("SELECT unixepoch()",[],|r|r.get(0)).map_err(err)?;
    let last=setting(&db,"backup_last","0").parse::<i64>().unwrap_or(0);
    if now-last<hours.clamp(1,168)*3600{return Ok(());}
    // Release the checkout connection while SQLite copies a consistent WAL snapshot.
    let keep=setting(&db,"backup_keep","0").parse::<usize>().unwrap_or(0);
    drop(db);
    let reader=Connection::open_with_flags(store.directory.join("grid.sqlite"),OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(err)?;
    reader.busy_timeout(std::time::Duration::from_secs(5)).map_err(err)?;
    let outcome=create(&reader,&store.directory,"auto").and_then(|path|{retain_automatic(&store.directory,keep)?;Ok(path)});
    drop(reader);
    let db=store.db.lock().map_err(err)?;
    match outcome {
        Ok(_)=>{db.execute("UPDATE settings SET value=? WHERE key='backup_last'",[now.to_string()]).map_err(err)?;db.execute("UPDATE settings SET value='' WHERE key='backup_error'",[]).map_err(err)?;},
        Err(error)=>{db.execute("UPDATE settings SET value=? WHERE key='backup_error'",[&error]).map_err(err)?;return Err(error);}
    }Ok(())
}
#[tauri::command]
pub fn backup_center(store:State<Store>,session_token:String)->Result<Value>{
    let db=store.db.lock().map_err(err)?;security::authorize(&store,&db,&session_token,"backup.create")?;
    let root=store.directory.join("respaldos");let mut files=Vec::new();
    if root.exists(){for entry in std::fs::read_dir(&root).map_err(err)? {
        let entry=entry.map_err(err)?;let meta=entry.metadata().map_err(err)?;
        if meta.is_file()&&entry.path().extension().is_some_and(|ext|ext=="sqlite") {
            files.push(json!({"name":entry.file_name().to_string_lossy(),"bytes":meta.len(),"modified":meta.modified().ok().and_then(|v|v.duration_since(std::time::UNIX_EPOCH).ok()).map(|v|v.as_secs()).unwrap_or(0)}));
        }
    }}
    files.sort_by(|a,b|b["modified"].as_u64().cmp(&a["modified"].as_u64()));
    Ok(json!({"files":files,"directory":root.to_string_lossy(),"hours":setting(&db,"backup_hours","24"),"keep":setting(&db,"backup_keep","0"),"last":setting(&db,"backup_last","0"),"error":setting(&db,"backup_error","")}))
}
#[tauri::command]
pub fn backup_schedule(store:State<Store>,session_token:String,hours:i64)->Result<()> {
    if ![0,1,6,12,24,168].contains(&hours){return Err("Frecuencia inválida".into());}
    let db=store.db.lock().map_err(err)?;let actor=security::authorize(&store,&db,&session_token,"backup.create")?;
    db.execute("UPDATE settings SET value=? WHERE key='backup_hours'",[hours.to_string()]).map_err(err)?;
    security::audit(&db,actor.id,json!({"type":"backup.schedule","hours":hours}))
}
#[tauri::command]
pub fn restore_backup(store:State<Store>,session_token:String,name:String,confirmation:String)->Result<()> {
    let _maintenance=MAINTENANCE.lock().map_err(err)?;
    let mut db=store.db.lock().map_err(err)?;
    let actor=security::authorize(&store,&db,&session_token,"backup.create")?;
    if actor.role!="owner"||confirmation!="RESTAURAR"{return Err("Solo el propietario puede restaurar; escribe RESTAURAR para confirmar".into());}
    if (!name.starts_with("grid-")&&!name.starts_with("mario-"))||!name.ends_with(".sqlite")||name.contains(['/', '\\', ':'])||name.contains(".."){return Err("Selecciona un respaldo de la lista".into());}
    let pending:i64=db.query_row("SELECT (SELECT count(*) FROM shifts WHERE closed IS NULL)+(SELECT count(*) FROM cart)+(SELECT count(*) FROM common_cart)+(SELECT count(*) FROM sales WHERE print_status='sending')",[],|r|r.get(0)).map_err(err)?;
    if pending>0{return Err("Cierra el turno, vacía los tickets y resuelve impresiones pendientes antes de restaurar".into());}
    let root=store.directory.join("respaldos").canonicalize().map_err(err)?;
    let source=root.join(name).canonicalize().map_err(err)?;
    if source.parent()!=Some(root.as_path()){return Err("Respaldo fuera de la carpeta autorizada".into());}
    let candidate=Connection::open_with_flags(&source,OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(err)?;
    let integrity:String=candidate.query_row("PRAGMA integrity_check",[],|r|r.get(0)).map_err(err)?;
    let version:i64=candidate.query_row("PRAGMA user_version",[],|r|r.get(0)).map_err(err)?;
    if integrity!="ok"||!(3..=7).contains(&version){return Err("Respaldo dañado o de otra versión. Se admiten versiones 3 a 7.".into());}
    let owners:i64=candidate.query_row("SELECT count(*) FROM users WHERE role='owner' AND enabled=1",[],|r|r.get(0)).map_err(err)?;
    if owners==0{return Err("El respaldo no contiene un propietario activo".into());}
    let violations:i64=candidate.query_row("SELECT count(*) FROM pragma_foreign_key_check",[],|r|r.get(0)).map_err(err)?;
    if violations!=0{return Err("El respaldo contiene referencias inconsistentes".into());}
    let mut staged=Connection::open_in_memory().map_err(err)?;
    { let copy=rusqlite::backup::Backup::new(&candidate,&mut staged).map_err(err)?;copy.run_to_completion(100,std::time::Duration::from_millis(5),None).map_err(err)?; }
    crate::advanced::migrate(&mut staged)?;
    crate::commerce::migrate(&mut staged)?;
    crate::retail::migrate(&mut staged)?;
    crate::network::migrate(&mut staged)?;
    staged.prepare("SELECT c.discount_authorized_by,u.discount_limit FROM cart c LEFT JOIN users u ON u.id=c.discount_authorized_by LIMIT 0").map_err(err)?;
    drop(candidate);
    let safety=create(&db,&store.directory,"antes-restaurar")?;
    staged.execute("INSERT INTO audit(event) VALUES(?)",params![json!({"type":"backup.restored","previous_actor":actor.name,"source":source.file_name().map(|v|v.to_string_lossy()),"safety":safety.to_string_lossy()}).to_string()]).map_err(err)?;
    let restored=(||->rusqlite::Result<()> {let copy=rusqlite::backup::Backup::new(&staged,&mut db)?;copy.run_to_completion(100,std::time::Duration::from_millis(5),None)})();
    if let Err(error)=restored {
        return match db.restore(DatabaseName::Main,&safety,None::<fn(rusqlite::backup::Progress)>) {
            Ok(())=>Err(format!("No se restauró; se recuperó el estado anterior: {}",error)),
            Err(recovery)=>Err(format!("Error de restauración: {}. Recuperación pendiente: {}. Copia de seguridad: {}",error,recovery,safety.display()))
        };
    }
    store.sessions.lock().map_err(err)?.clear();

    Ok(())
}

