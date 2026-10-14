#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{io::Read, path::PathBuf, sync::Mutex, time::Duration};
use tauri::{Manager, State};
use uuid::Uuid;

mod lifecycle;
mod print_queue;
mod security;
mod migrations;
mod business;
mod receipts;
mod advanced;
mod backups;
mod history;
mod commerce;
mod procurement;
mod retail;
mod catalog_import;
mod network;
mod network_transport;
mod rpc;
mod fiscal;
#[cfg(test)] mod tests;

struct Store { _instance:std::fs::File, db: Mutex<Connection>, directory: PathBuf, sessions: Mutex<security::Sessions>, grants:Mutex<security::Grants> }
type Result<T> = std::result::Result<T, String>;
fn err(e: impl std::fmt::Display) -> String { e.to_string() }

fn rows(db: &Connection, sql: &str) -> Result<Vec<Value>> {
    let mut stmt = db.prepare(sql).map_err(err)?;
    let names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let mapped = stmt.query_map([], |r| {
        let mut object = serde_json::Map::new();
        for (i, name) in names.iter().enumerate() {
            use rusqlite::types::ValueRef;
            let value = match r.get_ref(i)? {
                ValueRef::Null => Value::Null,
                ValueRef::Integer(n) => json!(n),
                ValueRef::Real(n) => json!(n),
                ValueRef::Text(s) => json!(String::from_utf8_lossy(s)),
                ValueRef::Blob(_) => Value::Null,
            };
            object.insert(name.clone(), value);
        }
        Ok(Value::Object(object))
    }).map_err(err)?;
    mapped.collect::<std::result::Result<Vec<_>, _>>().map_err(err)
}

fn initialize(db: &mut Connection) -> Result<()> {
    db.execute_batch(include_str!("schema.sql")).map_err(err)?;
    migrations::migrate(db)?;
    advanced::migrate(db)?;
    commerce::migrate(db)?;
    retail::migrate(db)?;
    network::migrate(db)?;
    let seeded: i64 = db.query_row("SELECT count(*) FROM settings WHERE key='catalog_seeded'", [], |r| r.get(0)).map_err(err)?;
    if seeded == 0 {
        let tx = db.transaction().map_err(err)?;
        tx.execute_batch(include_str!("inventory_seed.sql")).map_err(err)?;
        tx.execute("UPDATE products SET cost_known=1 WHERE cost>0", []).map_err(err)?;
        tx.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('catalog_seeded','1'),('seeded','1')", []).map_err(err)?;
        tx.commit().map_err(err)?;
    }
    Ok(())
}

#[tauri::command]
fn snapshot(store: State<Store>, session_token:String)->Result<Value> { let _operation=crate::lifecycle::enter()?; snapshot_service(&store, session_token) }
pub(crate) fn snapshot_service(store:&Store, session_token:String)->Result<Value> {
    let db = store.db.lock().map_err(err)?;
    let actor=security::authorize(&store,&db,&session_token,"")?;
    let all=actor.can("reports.view");
    let own=if all {String::new()}else{format!(" AND s.user_id={}",actor.id)};
    let products=rows(&db,&format!("SELECT p.id,p.code,p.name,p.category,p.icon,p.price,{} AS cost,p.cost_known,p.unit,CASE WHEN EXISTS(SELECT 1 FROM combo_items WHERE combo=p.id) THEN (SELECT min((child.stock-coalesce((SELECT sum(quantity) FROM lots WHERE product=child.id AND expires<date('now','localtime')),0))*1000/c.quantity) FROM combo_items c JOIN products child ON child.id=c.product WHERE c.combo=p.id) ELSE p.stock-coalesce((SELECT sum(quantity) FROM lots WHERE product=p.id AND expires<date('now','localtime')),0) END AS stock,p.stock AS physical_stock,coalesce((SELECT sum(quantity) FROM lots WHERE product=p.id AND expires<date('now','localtime')),0) AS expired_stock,p.minimum,p.target,p.wholesale_quantity,p.wholesale_price,p.favorite,(SELECT max(1,(p.price*(10000-max(percent))+5000)/10000) FROM promotions WHERE product=p.id AND enabled=1 AND date('now','localtime') BETWEEN starts AND ends) AS promotion_price FROM products p ORDER BY p.name",if actor.can("costs.view"){"p.cost"}else{"0"}))?;
    Ok(json!({
        "products":products,
        "expiry_alerts":if actor.can("inventory.view"){rows(&db,"SELECT count(*) AS count FROM lots WHERE quantity>0 AND expires<=date('now','localtime','+7 days')")?}else{vec![]},
        "aliases":rows(&db,"SELECT * FROM product_codes")?,
        "frequencies": rows(&db, "SELECT CAST(json_extract(item.value,'$.id') AS INTEGER) AS product,count(*) AS count FROM (SELECT receipt FROM sales ORDER BY rowid DESC LIMIT 500) s,json_each(s.receipt,'$.items') item GROUP BY product ORDER BY count DESC")?,
        "lines":rows(&db,&format!("SELECT ticket-{} AS ticket,product,quantity,override_price,reason FROM cart WHERE ticket BETWEEN {} AND {} UNION ALL SELECT ticket-{},-id,quantity,NULL,NULL FROM common_cart WHERE ticket BETWEEN {} AND {}",(network::register()-1)*5,(network::register()-1)*5+1,network::register()*5,(network::register()-1)*5,(network::register()-1)*5+1,network::register()*5))?,
        "common_products":rows(&db,&format!("SELECT -id AS id,name,price,0 AS cost,cost IS NOT NULL AS cost_known,'pieza' AS unit,'Productos comunes' AS category,'auto' AS icon,'' AS code,0 AS stock,0 AS physical_stock,0 AS expired_stock,0 AS minimum,0 AS target,0 AS wholesale_quantity,0 AS wholesale_price,0 AS favorite,NULL AS promotion_price,1 AS common FROM common_cart WHERE ticket BETWEEN {} AND {}",(network::register()-1)*5+1,network::register()*5))?,
        "customers":if actor.can("sales.create")||actor.can("credit.use")||actor.can("credit.repay")||actor.can("customers.manage"){rows(&db,"SELECT * FROM customers ORDER BY name")?}else{vec![]},
        "sales":rows(&db,&format!("SELECT s.id,s.total,coalesce(json_extract(s.receipt,'$.payment'),s.payment) AS payment,s.created,s.print_status,coalesce(u.name,'Histórico') AS cashier,EXISTS(SELECT 1 FROM refunds WHERE sale=s.id) AS refunded FROM sales s LEFT JOIN users u ON u.id=s.user_id WHERE 1=1{} ORDER BY s.rowid DESC LIMIT 100",own))?,
        "movements":if all||actor.can("cash.move"){rows(&db,&format!("SELECT m.* FROM movements m WHERE {} ORDER BY id DESC LIMIT 100",if all{"1=1".to_string()}else{format!("user_id={}",actor.id)}))?}else{vec![]},
        "ledger":if actor.can("credit.use")||actor.can("credit.repay"){rows(&db,"SELECT * FROM ledger ORDER BY id DESC LIMIT 100")?}else{vec![]},
        "repayments":if actor.can("credit.repay"){rows(&db,"SELECT * FROM repayment_receipts ORDER BY created DESC LIMIT 100")?}else{vec![]},
        "shift":rows(&db,&format!("SELECT s.id,s.created,s.user_id,coalesce(u.name,'Histórico') AS cashier FROM shifts s LEFT JOIN users u ON u.id=s.user_id WHERE s.closed IS NULL AND s.register_id={}",network::register()))?,
        "cuts":if all{rows(&db,"SELECT s.*,coalesce(u.name,'Histórico') AS cashier FROM shifts s LEFT JOIN users u ON u.id=s.user_id WHERE s.closed IS NOT NULL ORDER BY s.id DESC LIMIT 20")?}else{vec![]},
        "settings":rows(&db,"SELECT * FROM settings WHERE key IN ('store_name','store_address','store_phone','receipt_footer','accent','density','idle_minutes','daily_goal','sound','printer','baud','scale','scale_baud')")?,
        "stats":rows(&db,&format!("SELECT coalesce(sum(s.revenue),0) AS today,coalesce(sum(CASE WHEN s.revenue>0 THEN 1 ELSE 0 END),0) AS tickets FROM sale_metrics s WHERE date(s.created,'localtime')=date('now','localtime'){}",own))?,
        "pending":if all{rows(&db,"SELECT count(*) AS count FROM outbox WHERE sent IS NULL")?}else{vec![]}
    }))
}
#[derive(Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum Action {
    Cart { ticket: i64, product: i64, delta: i64 },
    Common { ticket:i64, name:String, quantity:i64, price:i64, cost:Option<i64> },
    Remove { ticket: i64, product: i64 },
    Product { id: Option<i64>, code: String, name: String, category: String, price: i64, cost: Option<i64>, unit: String, #[serde(default)] icon: Option<String> },
    Restock { product: i64, quantity: i64, note: String },
    Customer { name: String, phone: String, limit: i64, #[serde(default)] id:Option<i64>, #[serde(default)] email:String, #[serde(default)] address:String, #[serde(default)] credit_enabled:Option<bool> },
    Repay { customer: i64, amount: i64 },
    Movement { amount: i64, note: String },
    Open { amount: i64 },
    Close { counted: i64, denominations:Vec<(i64,i64)> },
    Settings { printer: String, baud: u32, scale: String, scale_baud: u32 },
    Preferences { sound: bool },
}
fn positive(n: i64) -> Result<()> { if n > 0 && n <= 100_000_000 { Ok(()) } else { Err("Importe o cantidad fuera de rango".into()) } }
fn valid_ticket(n: i64) -> Result<()> { if ((network::register()-1)*5+1..=network::register()*5).contains(&n) { Ok(()) } else { Err("Ticket inválido".into()) } }
fn active(db: &Connection) -> Result<i64> { db.query_row("SELECT id FROM shifts WHERE closed IS NULL AND register_id=?", [network::register()], |r| r.get(0)).map_err(|_| "Abre un turno antes de operar".into()) }
fn cash(db: &Connection, shift: i64) -> Result<i64> {
    db.query_row("SELECT opening + coalesce((SELECT sum(p.amount) FROM payments p JOIN sales s ON s.id=p.sale WHERE s.shift=?1 AND p.method='cash'),0) + coalesce((SELECT sum(amount) FROM movements WHERE shift=?1),0) FROM shifts WHERE id=?1", [shift], |r| r.get(0)).map_err(err)
}

#[tauri::command]
fn mutate(store: State<Store>, session_token:String, request_id:String, action: Action)->Result<Value> { let _operation=crate::lifecycle::enter()?; mutate_service(&store, session_token, request_id, action) }
pub(crate) fn mutate_service(store:&Store, session_token:String, request_id:String, action: Action)->Result<Value> {
    Uuid::parse_str(&request_id).map_err(err)?;
    let permission=match &action {
        Action::Common{..}|Action::Cart{..}|Action::Remove{..}=>"sales.create",Action::Product{..}=>"products.edit",Action::Restock{..}=>"inventory.manage",
        Action::Customer{..}=>"customers.manage",Action::Repay{..}=>"credit.repay",Action::Movement{..}=>"cash.move",
        Action::Open{..}=>"shifts.open",Action::Close{..}=>"shifts.close",Action::Settings{..}=>"settings.manage",Action::Preferences{..}=>""
    };
    let audit = serde_json::to_string(&action).map_err(err)?;
    let mut db = store.db.lock().map_err(err)?;
    let actor=security::authorize(&store,&db,&session_token,"")?;
    if !permission.is_empty()&&!(permission=="products.edit"&&actor.can("inventory.manage")){actor.require(permission)?;}
    let tx = db.transaction().map_err(err)?;
    let body=format!("mutate:{}:{}",network::register(),audit);
    if let Ok((owner,previous,response))=tx.query_row("SELECT user_id,body,response FROM requests WHERE id=?",[&request_id],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?))) {
        if owner!=actor.id||previous!=body{return Err("Solicitud reutilizada con otros datos".into());}
        return serde_json::from_str(&response).map_err(err);
    }
    let mut audit_event:Value=serde_json::from_str(&audit).map_err(err)?;
    let before=security::audit_state(&tx,&audit_event)?;
    let mut result = json!({});
    match action {
        Action::Common {ticket,name,quantity,price,cost} => {
            actor.require("sales.common")?;
            business::owned_shift(&tx,&actor)?;
            if cost.is_some() { actor.require("costs.view")?; }
            retail::add_common(&tx,ticket,&name,quantity,price,cost)?;
        },
        Action::Cart { ticket, product, delta } => {
            business::owned_shift(&tx,&actor)?; valid_ticket(ticket)?;
            if delta == 0 || delta.unsigned_abs() > 1_000_000 { return Err("Cantidad inválida".into()); }
            if product < 0 {
                actor.require("sales.common")?;
                retail::adjust_common(&tx,ticket,product.checked_neg().ok_or("Producto inválido")?,delta)?;
            } else {
            let unit: String = tx.query_row("SELECT unit FROM products WHERE id=?", [product], |r| r.get(0)).map_err(err)?;
            if unit == "pieza" && delta % 1000 != 0 { return Err("Este producto se vende por pieza".into()); }
            tx.execute("INSERT INTO cart(ticket,product,quantity) VALUES(?,?,?) ON CONFLICT(ticket,product) DO UPDATE SET quantity=quantity+excluded.quantity", params![ticket,product,delta]).map_err(err)?;
            tx.execute("DELETE FROM cart WHERE quantity<=0", []).map_err(err)?;
            let qty: i64 = tx.query_row("SELECT coalesce(max(quantity),0) FROM cart", [], |r| r.get(0)).map_err(err)?;
            if qty > 1_000_000 { return Err("Máximo 1,000 unidades por línea".into()); }
            }
        },
        Action::Remove { ticket, product } => { if actor.role!="owner"{business::owned_shift(&tx,&actor)?;}else{active(&tx)?;} valid_ticket(ticket)?; if product<0{tx.execute("DELETE FROM common_cart WHERE ticket=? AND id=?",params![ticket,product.checked_neg().ok_or("Producto inválido")?]).map_err(err)?;}else{tx.execute("DELETE FROM cart WHERE ticket=? AND product=?", params![ticket,product]).map_err(err)?;} },
        Action::Product { id, code, name, category, price, cost, unit, icon } => {
            actor.require("costs.view")?;
            // Only picker keys ("i:agua") or empty (automatic) are stored; legacy emoji stay untouched otherwise.
            let icon=match icon.as_deref().map(str::trim){
                None=>None,
                Some("")=>Some("auto".to_string()),
                Some(k) if k.len()<=40&&k.starts_with("i:")&&k[2..].chars().all(|c|c.is_ascii_lowercase()||c=='_')=>Some(k.to_string()),
                Some(k) if k.len()<=100&&k.starts_with("brand:")&&!k.contains(|c:char|c.is_control()||c=='\''||c=='"')=>Some(k.to_string()),
                _=>return Err("Icono inválido".into()),
            };
            if code.chars().chain(name.chars()).any(|c|c.is_control()){return Err("Caracteres de control no permitidos".into());}
            positive(price)?;
            if cost.is_some_and(|c| c < 0 || c > 100_000_000) || name.trim().is_empty() || name.len()>120 || code.trim().is_empty() || code.len()>64 || !["kg","pieza"].contains(&unit.as_str()) { return Err("Datos de producto inválidos".into()); }
            if let Some(id) = id {
                let in_cart: i64 = tx.query_row("SELECT count(*) FROM cart WHERE product=?", [id], |r| r.get(0)).map_err(err)?;
                if in_cart > 0 { return Err("Retira este producto de los tickets antes de editarlo".into()); }
                let old_unit: String = tx.query_row("SELECT unit FROM products WHERE id=?", [id], |r| r.get(0)).map_err(err)?;
                if old_unit != unit { actor.require("inventory.count")?; retail::correct_unit(&tx,id,&unit)?; }
                tx.execute("UPDATE products SET code=?,name=?,category=?,price=?,cost=? WHERE id=?", params![code.trim(),name.trim(),category,price,cost.unwrap_or(0),id]).map_err(err)?;
                if let Some(icon)=&icon { tx.execute("UPDATE products SET icon=? WHERE id=?", params![icon,id]).map_err(err)?; }
            } else {
                tx.execute("INSERT INTO products(code,name,category,price,cost,unit,icon,stock) VALUES(?,?,?,?,?,?,?,0)", params![code.trim(),name.trim(),category,price,cost.unwrap_or(0),unit,icon.clone().unwrap_or_else(||"auto".into())]).map_err(|_| "No se pudo crear: revisa que el código no exista".to_string())?;
            }
            let product_id=id.unwrap_or(tx.last_insert_rowid());
            tx.execute("UPDATE products SET cost_known=? WHERE id=?",params![cost.is_some(),product_id]).map_err(err)?;
            let conflict:i64=tx.query_row("SELECT count(*) FROM product_codes WHERE code=? AND product<>?",params![code.trim(),product_id],|r|r.get(0)).map_err(err)?;
            if conflict>0{return Err("Ese código pertenece a otro producto".into());}
            tx.execute("INSERT OR IGNORE INTO product_codes(code,product) VALUES(?,?)",params![code.trim(),product_id]).map_err(err)?;
            tx.execute("UPDATE products SET created=coalesce(created,strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id=?",[product_id]).map_err(err)?;
        },
        Action::Restock { product, quantity, note } => {
            let combos:i64=tx.query_row("SELECT count(*) FROM combo_items WHERE combo=?",[product],|r|r.get(0)).map_err(err)?;
            if combos>0{return Err("Surte los componentes del combo, no el combo".into());}
            positive(quantity)?;
            if note.trim().is_empty() { return Err("Indica proveedor o motivo".into()); }
            let unit: String = tx.query_row("SELECT unit FROM products WHERE id=?", [product], |r| r.get(0)).map_err(err)?;
            if unit=="pieza" && quantity%1000!=0 { return Err("Ingresa piezas enteras".into()); }
            tx.execute("UPDATE products SET stock=stock+? WHERE id=?", params![quantity,product]).map_err(err)?;
            tx.execute("INSERT INTO inventory(product,quantity,note) VALUES(?,?,?)", params![product,quantity,note]).map_err(err)?;
        },
        Action::Customer { name, phone, limit, id, email, address, credit_enabled } => {
            positive(limit)?;
            if name.trim().is_empty() || name.len()>120 || (!phone.is_empty() && (!phone.chars().all(|c|c.is_ascii_digit()) || !(phone.len()==10 || (phone.len()==12 && phone.starts_with("52"))))) { return Err("Indica un nombre y un teléfono de 10 dígitos, opcionalmente precedido por 52".into()); }
            if email.len()>120||address.len()>300{return Err("Correo o dirección demasiado largos".into());}
            if let Some(id)=id {
                if tx.execute("UPDATE customers SET name=?,phone=?,credit_limit=?,email=?,address=?,credit_enabled=? WHERE id=? AND balance<=?",params![name.trim(),phone,limit,email,address,credit_enabled.unwrap_or(true),id,limit]).map_err(err)?!=1{return Err("Cliente inexistente o límite inferior a su saldo pendiente".into());}
            }else{tx.execute("INSERT INTO customers(name,phone,credit_limit,email,address,credit_enabled) VALUES(?,?,?,?,?,?)",params![name.trim(),phone,limit,email,address,credit_enabled.unwrap_or(true)]).map_err(err)?;}
        },
        Action::Repay { customer, amount } => {
            positive(amount)?;
            let shift = business::owned_shift(&tx,&actor)?;
            let previous:i64=tx.query_row("SELECT balance FROM customers WHERE id=?",[customer],|r|r.get(0)).map_err(err)?;
            let changed = tx.execute("UPDATE customers SET balance=balance-?1 WHERE id=?2 AND balance>=?1", params![amount,customer]).map_err(err)?;
            if changed == 0 { return Err("El abono supera el saldo".into()); }
            tx.execute("INSERT INTO ledger(customer,amount,note) VALUES(?,?, 'Abono en efectivo')", params![customer,-amount]).map_err(err)?;
            tx.execute("INSERT INTO movements(shift,amount,note,user_id) VALUES(?,?,?,?)", params![shift,amount,format!("Abono cliente #{}",customer),actor.id]).map_err(err)?;
            let receipt_id=Uuid::new_v4().to_string();
            tx.execute("INSERT INTO repayment_receipts(id,customer,amount,previous_balance,balance,user_id) VALUES(?,?,?,?,?,?)",params![receipt_id,customer,amount,previous,previous-amount,actor.id]).map_err(err)?;
            result=json!({"id":receipt_id,"previous":previous,"amount":amount,"balance":previous-amount});
        },
        Action::Movement { amount, note } => {
            positive(amount.checked_abs().ok_or("Importe inválido")?)?;
            let shift = business::owned_shift(&tx,&actor)?;
            if note.trim().is_empty() || note.len()>200 { return Err("Escribe un motivo de hasta 200 caracteres".into()); }
            if amount < 0 && cash(&tx,shift)? + amount < 0 { return Err("No hay suficiente efectivo registrado".into()); }
            tx.execute("INSERT INTO movements(shift,amount,note,user_id) VALUES(?,?,?,?)", params![shift,amount,note,actor.id]).map_err(err)?;
        },
        Action::Open { amount } => {
            if amount < 0 || amount > 100_000_000 { return Err("Fondo inválido".into()); }
            if active(&tx).is_ok() { return Err("Ya hay un turno abierto".into()); }
            tx.execute("INSERT INTO shifts(opening,user_id,register_id) VALUES(?,?,?)", params![amount,actor.id,network::register()]).map_err(err)?;
        },
        Action::Close { counted, denominations } => {
            let mut denominations_total=0i64;let mut seen=std::collections::BTreeSet::new();
            for (value,count) in denominations {
                if ![100000,50000,20000,10000,5000,2000,1000,500,200,100,50].contains(&value)||!(0..=10000).contains(&count)||!seen.insert(value){return Err("Conteo por denominaciones inválido".into());}
                denominations_total+=value*count;
            }
            if denominations_total!=counted{return Err("El conteo no coincide con sus denominaciones".into());}
            if counted < 0 || counted > 100_000_000 { return Err("Conteo inválido".into()); }
            let pending: i64 = tx.query_row("SELECT (SELECT count(*) FROM cart WHERE ticket BETWEEN ?1 AND ?2)+(SELECT count(*) FROM common_cart WHERE ticket BETWEEN ?1 AND ?2)", params![(network::register()-1)*5+1,network::register()*5], |r| r.get(0)).map_err(err)?;
            if pending>0 { return Err("Termina o vacía los tickets pendientes antes del corte".into()); }
            let shift = if actor.role=="owner" {active(&tx)?}else{business::owned_shift(&tx,&actor)?};
            let expected = cash(&tx,shift)?;
            tx.execute("UPDATE shifts SET counted=?,expected=?,closed=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?", params![counted,expected,shift]).map_err(err)?;
            result = if actor.can("reports.view"){json!({"expected":expected,"difference":counted-expected})}else{json!({"closed":true})};
        },
        Action::Preferences { sound } => {
            tx.execute("INSERT INTO settings(key,value) VALUES('sound',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [if sound { "1" } else { "0" }]).map_err(err)?;
        },
        Action::Settings { printer, baud, scale, scale_baud } => {
            if ![1200,2400,4800,9600,19200,38400,57600,115200].contains(&baud) || ![1200,2400,4800,9600,19200,38400,57600,115200].contains(&scale_baud) { return Err("Baudrate no soportado".into()); }
            for (key,value) in [("printer",printer),("baud",baud.to_string()),("scale",scale),("scale_baud",scale_baud.to_string())] {
                tx.execute("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", params![key,value]).map_err(err)?;
            }
        },
    }
    let after=security::audit_state(&tx,&audit_event)?;
    audit_event["after"]=after;
    audit_event["before"]=before;
    security::audit(&tx,actor.id,audit_event)?;
    tx.execute("INSERT INTO requests(id,user_id,body,response) VALUES(?,?,?,?)",params![request_id,actor.id,body,result.to_string()]).map_err(err)?;
    tx.commit().map_err(err)?;
    Ok(result)
}

fn setting(db: &Connection, key: &str, fallback: &str) -> String {
    db.query_row("SELECT value FROM settings WHERE key=?", [key], |r| r.get(0)).unwrap_or_else(|_| fallback.into())
}

#[tauri::command]
fn backup(store: State<Store>, session_token:String) -> Result<String> { let _operation=crate::lifecycle::enter()?;
    let db = store.db.lock().map_err(err)?;
    security::authorize(&store,&db,&session_token,"backup.create")?;
    Ok(backups::create(&db,&store.directory,"manual")?.to_string_lossy().into_owned())
}

#[tauri::command]
fn serial_ports(store:State<Store>,session_token:String) -> Result<Vec<String>> { let _operation=crate::lifecycle::enter()?; let db=store.db.lock().map_err(err)?;security::authorize(&store,&db,&session_token,"hardware.use")?; Ok(serialport::available_ports().map_err(err)?.into_iter().map(|p|p.port_name).collect()) }

#[tauri::command]
async fn scale_read(store: State<'_,Store>, session_token:String) -> Result<String> { let _operation=crate::lifecycle::enter()?;
    let (port,baud) = { let db = store.db.lock().map_err(err)?;security::authorize(&store,&db,&session_token,"hardware.use")?; (setting(&db,"scale",""),setting(&db,"scale_baud","9600").parse::<u32>().unwrap_or(9600)) };
    if port.is_empty() { return Err("Configura el puerto de báscula".into()); }
    tauri::async_runtime::spawn_blocking(move || {
        let mut device = serialport::new(port,baud).timeout(Duration::from_secs(2)).open().map_err(err)?;
        let mut bytes = [0u8;256];
        let count = device.read(&mut bytes).map_err(err)?;
        Ok(String::from_utf8_lossy(&bytes[..count]).to_string())
    }).await.map_err(err)?
}

#[tauri::command]
fn open_whatsapp(store:State<Store>,session_token:String,phone:String,message:String)->Result<()> { let _operation=crate::lifecycle::enter()?;
    let db=store.db.lock().map_err(err)?;
    let _actor=security::authorize(&store,&db,&session_token,"")?;
    if !(11..=15).contains(&phone.len())||phone.starts_with('0')||!phone.bytes().all(|b|b.is_ascii_digit())||message.len()>16000{return Err("Teléfono o mensaje inválido".into());}
    let encoded:String=message.bytes().map(|b|format!("%{:02X}",b)).collect();
    let url=format!("https://wa.me/{}?text={}",phone,encoded);
    drop(db);
    #[cfg(target_os="windows")]
    {std::process::Command::new("explorer.exe").arg(url).spawn().map_err(err)?;Ok(())}
    #[cfg(not(target_os="windows"))]
    {let _=url;Err("Esta acción está disponible en la aplicación de Windows".into())}
}

fn main() {
    tauri::Builder::default().setup(|app| {
        let directory = app.path().app_data_dir()?;
        std::fs::create_dir_all(&directory)?;
        // Windows denies a second open while this process holds the handle.
        let mut instance_options=std::fs::OpenOptions::new();
        instance_options.read(true).write(true).create(true);
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            instance_options.share_mode(0);
        }
        let instance = match instance_options.open(directory.join(".grid-instance.lock")) {
            Ok(f) => f,
            Err(error) if cfg!(windows) && error.raw_os_error()==Some(32) => {
                #[cfg(windows)]
                unsafe {
                    extern "system" {
                        fn FindWindowW(class: *const u16, title: *const u16) -> isize;
                        fn SetForegroundWindow(hwnd: isize) -> i32;
                        fn ShowWindow(hwnd: isize, cmd: i32) -> i32;
                    }
                    let title: Vec<u16> = "Grid POS · Punto de Venta\0".encode_utf16().collect();
                    let hwnd = FindWindowW(std::ptr::null(), title.as_ptr());
                    if hwnd != 0 {
                        ShowWindow(hwnd, 9);
                        SetForegroundWindow(hwnd);
                    }
                }
                std::process::exit(0);
            }
            Err(error) => return Err(error.into()),
        };
        let mut db = Connection::open(directory.join("grid.sqlite"))?;
        db.busy_timeout(Duration::from_secs(5))?;
        let integrity:String=db.query_row("PRAGMA integrity_check",[],|r|r.get(0))?;
        if integrity!="ok"{return Err(std::io::Error::other("La base de datos requiere recuperación desde un respaldo").into());}
        initialize(&mut db).map_err(std::io::Error::other)?;
        // Interrupted jobs require an operator decision, never automatic replay.
        db.execute("UPDATE sales SET print_status='uncertain' WHERE print_status='sending'", [])?;

        db.execute_batch("CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created);
          CREATE INDEX IF NOT EXISTS idx_sales_user_created ON sales(user_id,created);
          CREATE INDEX IF NOT EXISTS idx_ledger_customer_created ON ledger(customer,created);
          CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product);
          CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT,'La bitácora no se edita'); END;
          CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT,'La bitácora no se elimina'); END;")?;
        app.manage(Store { _instance:instance, db:Mutex::new(db), directory, sessions:Mutex::new(std::collections::HashMap::new()), grants:Mutex::new(std::collections::HashMap::new()) });
        let handle=app.handle().clone();
        std::thread::spawn(move || {
            loop {
                if !lifecycle::closing() { let store=handle.state::<Store>(); let _=backups::automatic(&store); }
                for _ in 0..60 {
                    std::thread::sleep(Duration::from_secs(1));
                }
            }
        });
        Ok(())
    }).on_window_event(|window, event| {
        if window.label()!="main" { return; }
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            if !lifecycle::begin_shutdown() { return; }
            let _ = window.set_title("Grid POS · Cerrando operaciones…");
            let handle=window.app_handle().clone();
            std::thread::spawn(move || {
                if !lifecycle::wait_for_operations(Duration::from_secs(60)) {
                    if let Some(window)=handle.get_webview_window("main") {
                        let _=window.set_title("Grid POS · Hay una operación pendiente. Intenta cerrar de nuevo.");
                    }
                    lifecycle::cancel_shutdown();
                    return;
                }
                let store=handle.state::<Store>();
                match store.db.lock() {
                    Ok(db) => {
                        if db.execute("UPDATE sales SET print_status='uncertain' WHERE print_status='sending'", []).is_err() {
                            lifecycle::cancel_shutdown();
                            if let Some(window)=handle.get_webview_window("main") {
                                let _=window.set_title("Grid POS · No se pudo completar el cierre. Intenta de nuevo.");
                            }
                            return;
                        }
                    }
                    Err(_) => { lifecycle::cancel_shutdown(); return; }
                }
                handle.exit(0);
            });
        }
    }).invoke_handler(tauri::generate_handler![network::connection_call,network::connection_save,network::connection_status,network::network_start,network::network_pair,network::network_registers,catalog_import::catalog_preview,catalog_import::catalog_apply,open_whatsapp,security::approve_operation,procurement::procurement_list,procurement::procurement_save,history::sale_history,advanced::advanced_save,advanced::advanced_list,advanced::filtered_report,backups::backup_retention,backups::export_backup,backups::backup_center,backups::backup_schedule,backups::restore_backup,snapshot,mutate,business::checkout,business::operate,business::management,security::auth_status,security::bootstrap_owner,security::login,security::logout,security::users_list,security::user_save,backup,serial_ports,receipts::print_sale,receipts::print_repayment,receipts::resolve_print,scale_read])
      .run(tauri::generate_context!()).expect("No se pudo iniciar Grid POS");
}







