use crate::{err, rows, setting, Result, Store};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier, password_hash::SaltString};
use rand_core::OsRng;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{collections::HashMap, time::{Instant,Duration}};
use tauri::State;
use uuid::Uuid;

pub type Sessions = HashMap<String,(i64,Instant,i64)>;
pub const PERMISSIONS: &[&str] = &["sales.common","products.edit","purchases.create","inventory.loss","inventory.rules","inventory.codes","inventory.combos","inventory.count","promotions.manage","sales.create","sales.discount","sales.refund","credit.use","credit.repay","customers.manage","inventory.view","inventory.manage","costs.view","cash.move","shifts.open","shifts.close","reports.view","settings.manage","users.manage","audit.view","backup.create","hardware.use","receipt.print"];

#[derive(Clone,Serialize)]
pub struct Actor { pub id:i64, pub name:String, pub role:String, pub permissions:Vec<String> }
impl Actor {
    pub fn can(&self, permission:&str) -> bool { self.role=="owner" || self.permissions.iter().any(|p|p==permission) }
    pub fn require(&self, permission:&str)->Result<()> { if self.can(permission) {Ok(())} else {Err(format!("Sin permiso: {}",permission))} }
}
pub fn audit(db:&Connection, actor:i64, mut event:Value)->Result<()> {
    let name:String=db.query_row("SELECT name FROM users WHERE id=?",[actor],|r|r.get(0)).map_err(err)?;
    event["actor_name"]=json!(name);
    event["register"]=json!(crate::network::register());
    if let Some(id)=event["approved_by"].as_i64().or(event["supervisor"].as_i64()){
        let name:Option<String>=db.query_row("SELECT name FROM users WHERE id=?",[id],|r|r.get(0)).ok();event["supervisor_name"]=json!(name);
    }
    db.execute("INSERT OR IGNORE INTO settings(key,value) VALUES('audit_device_id',?)",[Uuid::new_v4().to_string()]).map_err(err)?;
    event["device"]=json!(setting(db,"audit_device_id",""));
    db.execute("INSERT INTO audit(user_id,event) VALUES(?,?)",params![actor,event.to_string()]).map_err(err)?; Ok(())
}
pub fn authorize(store:&Store, db:&Connection, token:&str, permission:&str)->Result<Actor> {
    if crate::lifecycle::closing(){return Err("La caja se está cerrando. Espera a que termine.".into());}
    let mut sessions=store.sessions.lock().map_err(err)?;
    let timeout=setting(db,"idle_minutes","15").parse::<u64>().unwrap_or(15).clamp(1,120);
    sessions.retain(|_,(_,last,_)|last.elapsed()<Duration::from_secs(timeout*60));
    let (id,last,register_id)=sessions.get_mut(token).ok_or("SESSION_EXPIRED")?;
    if *register_id!=crate::network::register(){return Err("SESSION_EXPIRED".into());}
    let actor=db.query_row("SELECT id,name,role,permissions FROM users WHERE id=? AND enabled=1",[*id],|r|{
        let raw:String=r.get(3)?;
        Ok(Actor{id:r.get(0)?,name:r.get(1)?,role:r.get(2)?,permissions:serde_json::from_str(&raw).unwrap_or_default()})
    }).map_err(|_|"SESSION_EXPIRED".to_string())?;
    if !permission.is_empty()&&!actor.can(permission){audit(db,actor.id,json!({"type":"permission.denied","permission":permission}))?;actor.require(permission)?;}
    *last=Instant::now();
    Ok(actor)
}
fn hash(password:&str)->Result<String> {
    if password.chars().count()<8 || password.len()>128 {return Err("La contraseña debe tener al menos 8 caracteres y como máximo 128 bytes".into());}
    let salt=SaltString::generate(&mut OsRng);
    Argon2::new(argon2::Algorithm::Argon2id,argon2::Version::V0x13,argon2::Params::new(65536,3,2,None).map_err(err)?).hash_password(password.as_bytes(),&salt).map(|h|h.to_string()).map_err(err)
}
fn check_identity(username:&str,name:&str)->Result<()> {
    if username.len()<3 || username.len()>40 || !username.chars().all(|c|c.is_ascii_alphanumeric()||c=='_'||c=='-') || name.trim().is_empty() || name.len()>100 {return Err("Usuario: 3–40 letras, números, guion o guion bajo. Indica también el nombre.".into());} Ok(())
}
#[tauri::command]
pub fn auth_status(store:State<Store>)->Result<Value> { let _operation=crate::lifecycle::enter()?; auth_status_service(&store) }
pub(crate) fn auth_status_service(store:&Store)->Result<Value> {
    let db=store.db.lock().map_err(err)?;
    let count:i64=db.query_row("SELECT count(*) FROM users",[],|r|r.get(0)).map_err(err)?;
    Ok(json!({"setup":count==0,"profiles":rows(&db,"SELECT id,username,name,role FROM users WHERE enabled=1 ORDER BY name")?}))
}
#[tauri::command]
pub fn bootstrap_owner(store:State<Store>,username:String,name:String,password:String)->Result<()> { let _operation=crate::lifecycle::enter()?;
    check_identity(&username,&name)?;
    let mut db=store.db.lock().map_err(err)?;
    let tx=db.transaction().map_err(err)?;
    let count:i64=tx.query_row("SELECT count(*) FROM users",[],|r|r.get(0)).map_err(err)?;
    if count!=0{return Err("Ya existe un propietario. Inicia sesión.".into());}
    let password_hash=hash(&password)?;
    tx.execute("INSERT INTO users(username,name,password_hash,role) VALUES(?,?,?,'owner')",params![username.trim(),name.trim(),password_hash]).map_err(err)?;
    let id=tx.last_insert_rowid();
    tx.execute("UPDATE shifts SET user_id=? WHERE closed IS NULL AND user_id IS NULL",[id]).map_err(err)?;
    audit(&tx,id,json!({"type":"owner.created"}))?;
    tx.commit().map_err(err)
}
#[tauri::command]
pub fn login(store:State<Store>,username:String,password:String)->Result<Value> { let _operation=crate::lifecycle::enter()?; login_service(&store, username, password) }
pub(crate) fn login_service(store:&Store, username:String,password:String)->Result<Value> {
    if username.len()>40||password.len()>128{return Err("Credenciales inválidas".into());}
    let db=store.db.lock().map_err(err)?;
    let row=db.query_row("SELECT id,password_hash,locked_until,enabled FROM users WHERE username=?",[username.trim()],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,String>(1)?,r.get::<_,i64>(2)?,r.get::<_,i64>(3)?)));
    let now:i64=db.query_row("SELECT unixepoch()",[],|r|r.get(0)).map_err(err)?;
    let (id,stored,locked,enabled)=match row {Ok(row)=>row,Err(_)=>{let _=hash("invalid-login-dummy");return Err("Usuario o contraseña incorrectos".into());}};
    if locked>now{return Err(format!("Cuenta bloqueada temporalmente. Intenta de nuevo en {} segundos.",locked-now));}
    let valid=PasswordHash::new(&stored).ok().map(|h|Argon2::default().verify_password(password.as_bytes(),&h).is_ok()).unwrap_or(false);
    if !valid || enabled!=1 {
        db.execute("UPDATE users SET failures=failures+1,locked_until=CASE WHEN failures>=4 THEN unixepoch()+CASE WHEN failures>=9 THEN 300 ELSE 30 END ELSE 0 END WHERE id=?",[id]).map_err(err)?;
        audit(&db,id,json!({"type":"login.denied"}))?;
        return Err("Usuario o contraseña incorrectos".into());
    }
    db.execute("UPDATE users SET failures=0,locked_until=0 WHERE id=?",[id]).map_err(err)?;

    let token=Uuid::new_v4().to_string();
    {let mut sessions=store.sessions.lock().map_err(err)?;sessions.retain(|_,(_,_,register)|*register!=crate::network::register());sessions.insert(token.clone(),(id,Instant::now(),crate::network::register()));}
    let actor=authorize(&store,&db,&token,"")?;
    audit(&db,id,json!({"type":"login.success"}))?;
    Ok(json!({"token":token,"user":actor,"idleMinutes":setting(&db,"idle_minutes","15").parse::<u64>().unwrap_or(15)}))
}

#[derive(Deserialize)]
pub struct Approval { pub username:String, pub password:String }
pub fn approve(db:&Connection,approval:Approval,permission:&str)->Result<Actor> {
    if approval.username.len()>40||approval.password.len()>128{return Err("Credenciales inválidas".into());}
    let (id,name,role,permissions,stored,enabled,locked):(i64,String,String,String,String,i64,i64)=db.query_row("SELECT id,name,role,permissions,password_hash,enabled,locked_until FROM users WHERE username=?",[approval.username.trim()],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?,r.get(6)?))).map_err(|_|"Autorización incorrecta".to_string())?;
    let now:i64=db.query_row("SELECT unixepoch()",[],|r|r.get(0)).map_err(err)?;
    if locked>now{return Err(format!("Autorización bloqueada temporalmente. Espera {} segundos.",locked-now));}
    let valid=PasswordHash::new(&stored).ok().map(|h|Argon2::default().verify_password(approval.password.as_bytes(),&h).is_ok()).unwrap_or(false);
    if !valid||enabled!=1{db.execute("UPDATE users SET failures=failures+1,locked_until=CASE WHEN failures>=4 THEN unixepoch()+CASE WHEN failures>=9 THEN 300 ELSE 30 END ELSE 0 END WHERE id=?",[id]).map_err(err)?;audit(db,id,json!({"type":"approval.denied","permission":permission}))?;return Err("Autorización incorrecta".into());}
    let actor=Actor{id,name,role,permissions:serde_json::from_str(&permissions).map_err(err)?};actor.require(permission)?;
    db.execute("UPDATE users SET failures=0,locked_until=0 WHERE id=?",[id]).map_err(err)?;Ok(actor)
}
#[tauri::command]
pub fn logout(store:State<Store>,session_token:String)->Result<()> { let _operation=crate::lifecycle::enter()?; logout_service(&store, session_token) }
pub(crate) fn logout_service(store:&Store, session_token:String)->Result<()> {
    let db=store.db.lock().map_err(err)?;
    if let Ok(actor)=authorize(&store,&db,&session_token,""){audit(&db,actor.id,json!({"type":"session.locked"}))?;}
    store.grants.lock().map_err(err)?.retain(|_,grant|grant.session!=session_token);
    crate::fiscal::forget(&session_token);
    store.sessions.lock().map_err(err)?.remove(&session_token); Ok(())
}
#[derive(Deserialize)]
pub struct UserInput {id:Option<i64>,username:String,name:String,role:String,permissions:Vec<String>,enabled:bool,password:Option<String>,#[serde(default)] discount_limit:i64}
#[tauri::command]
pub fn users_list(store:State<Store>,session_token:String)->Result<Value> { let _operation=crate::lifecycle::enter()?; users_list_service(&store, session_token) }
pub(crate) fn users_list_service(store:&Store, session_token:String)->Result<Value> {
    let db=store.db.lock().map_err(err)?;
    let actor=authorize(&store,&db,&session_token,"users.manage")?;
    if actor.role!="owner"{return Err("Solo el propietario administra usuarios".into());}
    Ok(json!({"users":rows(&db,"SELECT id,username,name,role,permissions,enabled,discount_limit FROM users ORDER BY name")?,"permissions":PERMISSIONS}))
}
#[tauri::command]
pub fn user_save(store:State<Store>,session_token:String,input:UserInput)->Result<()> { let _operation=crate::lifecycle::enter()?; user_save_service(&store, session_token, input) }
pub(crate) fn user_save_service(store:&Store, session_token:String,input:UserInput)->Result<()> {
    let mut db=store.db.lock().map_err(err)?;
    let actor=authorize(&store,&db,&session_token,"users.manage")?;
    if actor.role!="owner"{return Err("Solo el propietario administra usuarios".into());}
    check_identity(&input.username,&input.name)?;
    if !(0..=10000).contains(&input.discount_limit){return Err("Límite de descuento inválido".into());}
    if !["owner","manager","cashier","stock","custom"].contains(&input.role.as_str()) || input.permissions.iter().any(|p|!PERMISSIONS.contains(&p.as_str())){return Err("Rol o permisos inválidos".into());}
    if input.role!="owner"&&input.permissions.iter().any(|p|p=="users.manage"){return Err("Administrar usuarios es exclusivo del propietario".into());}
    if input.id==Some(actor.id)&&(!input.enabled||input.role!="owner"){return Err("No puedes retirar tu propio acceso de propietario".into());}
    let tx=db.transaction().map_err(err)?;
    let permissions=serde_json::to_string(&input.permissions).map_err(err)?;
    let target=if let Some(id)=input.id {
        let current:String=tx.query_row("SELECT role FROM users WHERE id=?",[id],|r|r.get(0)).map_err(err)?;
        let owners:i64=tx.query_row("SELECT count(*) FROM users WHERE role='owner' AND enabled=1 AND id<>?",[id],|r|r.get(0)).map_err(err)?;
        if current=="owner"&&owners==0&&(!input.enabled||input.role!="owner"){return Err("Debe quedar un propietario activo".into());}
        tx.execute("UPDATE users SET username=?,name=?,role=?,permissions=?,enabled=?,failures=0,locked_until=0 WHERE id=?",params![input.username,input.name,input.role,permissions,input.enabled,id]).map_err(err)?;
        if let Some(password)=input.password.filter(|p|!p.is_empty()){tx.execute("UPDATE users SET password_hash=? WHERE id=?",params![hash(&password)?,id]).map_err(err)?;}
        id
    } else {
        let password=input.password.ok_or("Define una contraseña")?;
        tx.execute("INSERT INTO users(username,name,role,permissions,enabled,password_hash) VALUES(?,?,?,?,?,?)",params![input.username,input.name,input.role,permissions,input.enabled,hash(&password)?]).map_err(err)?;
        tx.last_insert_rowid()
    };
    tx.execute("UPDATE users SET discount_limit=? WHERE id=?",params![input.discount_limit,target]).map_err(err)?;
    audit(&tx,actor.id,json!({"type":"user.saved","discount_limit":input.discount_limit,"target":target,"role":input.role,"permissions":input.permissions,"enabled":input.enabled}))?;
    tx.commit().map_err(err)?;
    store.grants.lock().map_err(err)?.clear();
    store.sessions.lock().map_err(err)?.retain(|_,(id,_,_)|*id!=target);
    Ok(())
}



// Grants are process-local, bound to a session and exact operation, and removed before use.
pub struct Grant {session:String,request:String,body:String,supervisor:i64,created:Instant}
pub type Grants=HashMap<String,Grant>;
#[tauri::command]
pub fn approve_operation(store:State<Store>,session_token:String,request_id:String,operation:crate::business::Operation,approval:Approval)->Result<String> { let _operation=crate::lifecycle::enter()?; approve_operation_service(&store, session_token, request_id, operation, approval) }
pub(crate) fn approve_operation_service(store:&Store, session_token:String,request_id:String,operation:crate::business::Operation,approval:Approval)->Result<String> {
    Uuid::parse_str(&request_id).map_err(err)?;
    let permission=match &operation{crate::business::Operation::Discount{..}=>"sales.discount",crate::business::Operation::Refund{..}=>"sales.refund",_=>return Err("Operación no autorizable".into())};
    let db=store.db.lock().map_err(err)?;
    let actor=authorize(&store,&db,&session_token,"")?;
    let supervisor=approve(&db,approval,permission)?;
    let body=serde_json::to_string(&operation).map_err(err)?;
    let nonce=Uuid::new_v4().to_string();
    let mut grants=store.grants.lock().map_err(err)?;
    grants.retain(|_,g|g.created.elapsed()<Duration::from_secs(60)&&g.session!=session_token);
    audit(&db,actor.id,json!({"type":"approval.issued","supervisor":supervisor.id,"request":request_id,"permission":permission}))?;
    grants.insert(nonce.clone(),Grant{session:session_token,request:request_id,body,supervisor:supervisor.id,created:Instant::now()});
    Ok(nonce)
}
pub fn consume_grant(store:&Store,db:&Connection,nonce:&str,session:&str,request:&str,body:&str,permission:&str)->Result<i64>{
    let grant=store.grants.lock().map_err(err)?.remove(nonce).ok_or("Autorización usada o inexistente")?;
    if grant.created.elapsed()>=Duration::from_secs(60)||grant.session!=session||grant.request!=request||grant.body!=body{return Err("Autorización vencida o distinta a esta operación".into());}
    let (role,raw):(String,String)=db.query_row("SELECT role,permissions FROM users WHERE id=? AND enabled=1",[grant.supervisor],|r|Ok((r.get(0)?,r.get(1)?))).map_err(err)?;
    let permissions:Vec<String>=serde_json::from_str(&raw).map_err(err)?;
    if role!="owner"&&!permissions.iter().any(|p|p==permission){return Err("El supervisor ya no tiene permiso".into());}
    Ok(grant.supervisor)
}

// Only business fields are captured: never credentials, session tokens or approval nonces.
pub fn audit_state(db:&Connection,operation:&Value)->Result<Value>{
    let kind=operation["type"].as_str().unwrap_or("");
    if ["product","restock","count","rules","loss","discount","alias","combo"].contains(&kind){
        let id=operation["product"].as_i64().or(operation["id"].as_i64());
        if let Some(id)=id{
            let mut value=db.query_row("SELECT name,price,cost,stock,minimum,target,unit,cost_known FROM products WHERE id=?",[id],|r|Ok(json!({"name":r.get::<_,String>(0)?,"price":r.get::<_,i64>(1)?,"cost":r.get::<_,i64>(2)?,"stock":r.get::<_,i64>(3)?,"minimum":r.get::<_,i64>(4)?,"target":r.get::<_,i64>(5)?,"unit":r.get::<_,String>(6)?,"cost_known":r.get::<_,i64>(7)?}))).map_err(err)?;
            if kind=="discount"{let ticket=operation["ticket"].as_i64().ok_or("Ticket inválido")?;let price:Option<i64>=db.query_row("SELECT override_price FROM cart WHERE ticket=? AND product=?",params![ticket,id],|r|r.get(0)).map_err(err)?;value["special_price"]=json!(price);}
            return Ok(value);
        }
    }
    if ["customer","repay"].contains(&kind){if let Some(id)=operation["customer"].as_i64().or(operation["id"].as_i64()){
        return db.query_row("SELECT name,balance,credit_limit,credit_enabled FROM customers WHERE id=?",[id],|r|Ok(json!({"name":r.get::<_,String>(0)?,"balance":r.get::<_,i64>(1)?,"credit_limit":r.get::<_,i64>(2)?,"credit_enabled":r.get::<_,i64>(3)?}))).map_err(err);
    }}
    Ok(Value::Null)
}
