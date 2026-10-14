use crate::{err, rows, security, Result, Store};
use rusqlite::{params, Connection};
use serde::Deserialize;
use serde_json::{json,Value};
use tauri::State;

pub fn migrate(db:&mut Connection)->Result<()> {
    let version:i64=db.query_row("PRAGMA user_version",[],|r|r.get(0)).map_err(err)?;
    if version>=3{return migrate_discount_author(db);}
    let tx=db.transaction().map_err(err)?;
    tx.execute_batch("CREATE TABLE lots(id INTEGER PRIMARY KEY,product INTEGER NOT NULL REFERENCES products(id),code TEXT NOT NULL,expires TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>=0),UNIQUE(product,code));
      CREATE TABLE sale_lots(sale TEXT NOT NULL,lot INTEGER NOT NULL REFERENCES lots(id),quantity INTEGER NOT NULL,PRIMARY KEY(sale,lot));
      CREATE TABLE promotions(id INTEGER PRIMARY KEY,name TEXT NOT NULL,product INTEGER NOT NULL REFERENCES products(id),percent INTEGER NOT NULL CHECK(percent BETWEEN 1 AND 9500),starts TEXT NOT NULL,ends TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1);
      ALTER TABLE users ADD COLUMN discount_limit INTEGER NOT NULL DEFAULT 0;
      INSERT OR IGNORE INTO settings VALUES('backup_hours','24'),('backup_last','0'),('backup_error','');
      CREATE INDEX lots_expiry ON lots(product,expires);
      CREATE INDEX promotions_dates ON promotions(product,starts,ends);
      PRAGMA user_version=3;").map_err(err)?;
    tx.commit().map_err(err)?;
    migrate_discount_author(db)
}
fn migrate_discount_author(db:&mut Connection)->Result<()> {
    let version:i64=db.query_row("PRAGMA user_version",[],|r|r.get(0)).map_err(err)?;
    if version>=4{return Ok(());}
    let tx=db.transaction().map_err(err)?;
    tx.execute_batch("ALTER TABLE cart ADD COLUMN discount_authorized_by INTEGER REFERENCES users(id); PRAGMA user_version=4;").map_err(err)?;
    tx.commit().map_err(err)
}
pub fn check_discount(db:&Connection,author:i64,price:i64,base:i64)->Result<()> {
    let (role,limit,permissions):(String,i64,String)=db.query_row("SELECT role,discount_limit,permissions FROM users WHERE id=? AND enabled=1",[author],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).map_err(|_|"La autorización del descuento ya no está vigente".to_string())?;
    let allowed:Vec<String>=serde_json::from_str(&permissions).map_err(err)?;
    if role!="owner"&&(!allowed.iter().any(|p|p=="sales.discount")||price*10000<base*(10000-limit)) {return Err("El descuento supera el permiso o límite vigente. Solicita autorización nuevamente.".into());}
    Ok(())
}
pub fn valid_date(db:&Connection,date:&str)->Result<()> {
    let valid:bool=db.query_row("SELECT length(?1)=10 AND coalesce(date(?1,'+0 days')=?1,0)",[date],|r|r.get(0)).map_err(err)?;
    if !valid{return Err("Fecha inválida; usa año-mes-día".into());}Ok(())
}
pub fn promo_price(db:&Connection,product:i64,base:i64)->Result<i64>{
    let percent:i64=db.query_row("SELECT coalesce(max(percent),0) FROM promotions WHERE product=? AND enabled=1 AND date('now','localtime') BETWEEN starts AND ends",[product],|r|r.get(0)).map_err(err)?;
    Ok(((base*(10000-percent)+5000)/10000).max(1))
}
// Stock without a lot remains available. Tracked stock is depleted by earliest expiry.
pub fn consume_lots(db:&Connection,product:i64,quantity:i64,sale:Option<&str>,allow_expired:bool)->Result<()> {
    let sql=if allow_expired{"SELECT id,quantity FROM lots WHERE product=? AND quantity>0 ORDER BY expires,id"}else{"SELECT id,quantity FROM lots WHERE product=? AND quantity>0 AND expires>=date('now','localtime') ORDER BY expires,id"};
    let mut stmt=db.prepare(sql).map_err(err)?;
    let lots=stmt.query_map([product],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,i64>(1)?))).map_err(err)?.collect::<std::result::Result<Vec<_>,_>>().map_err(err)?;
    let mut left=quantity;
    for (id,remaining) in lots {let used=left.min(remaining);if used==0{break;}
        db.execute("UPDATE lots SET quantity=quantity-? WHERE id=?",params![used,id]).map_err(err)?;
        if let Some(sale)=sale {db.execute("INSERT INTO sale_lots VALUES(?,?,?)",params![sale,id,used]).map_err(err)?;}
        left-=used;
    }Ok(())
}
#[derive(Deserialize)]
#[serde(tag="type",rename_all="snake_case")]
pub enum Edit {
    Lot{product:i64,code:String,expires:String,quantity:i64},
    Discard{lot:i64,reason:String},
    Promotion{name:String,product:i64,percent:i64,starts:String,ends:String},
    Toggle{id:i64,enabled:bool},
}
#[tauri::command]
pub fn advanced_save(store:State<Store>,session_token:String,edit:Edit)->Result<()> { advanced_save_service(&store, session_token, edit) }
pub(crate) fn advanced_save_service(store:&Store, session_token:String,edit:Edit)->Result<()> {
    let mut db=store.db.lock().map_err(err)?;
    let permission=match &edit{Edit::Promotion{..}|Edit::Toggle{..}=>"promotions.manage",_=>"inventory.manage"};
    let actor=security::authorize(&store,&db,&session_token,permission)?;
    let tx=db.transaction().map_err(err)?;
    let event=match edit {
        Edit::Lot{product,code,expires,quantity}=>{
            valid_date(&tx,&expires)?;
            if code.trim().is_empty()||code.len()>80||quantity<=0||quantity>1_000_000{return Err("Indica lote, fecha y cantidad válidos".into());}
            let (free,unit,combo):(i64,String,i64)=tx.query_row("SELECT stock-coalesce((SELECT sum(quantity) FROM lots WHERE product=p.id),0),unit,(SELECT count(*) FROM combo_items WHERE combo=p.id) FROM products p WHERE id=?",[product],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).map_err(err)?;
            if combo>0||quantity>free||(unit=="pieza"&&quantity%1000!=0){return Err("Asigna piezas completas de existencias sin lote; los combos no admiten lotes propios".into());}
            tx.execute("INSERT INTO lots(product,code,expires,quantity) VALUES(?,?,?,?)",params![product,code.trim(),expires,quantity]).map_err(|_|"Ese lote ya existe para este producto".to_string())?;
            json!({"type":"lot.assigned","product":product,"quantity":quantity,"code":code})
        },
        Edit::Discard{lot,reason}=>{
            if reason.trim().is_empty()||reason.len()>200{return Err("Escribe el motivo de merma".into());}
            let (product,qty,cost):(i64,i64,i64)=tx.query_row("SELECT l.product,l.quantity,p.cost FROM lots l JOIN products p ON p.id=l.product WHERE l.id=?",[lot],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).map_err(err)?;
            if qty<=0{return Err("El lote ya está vacío".into());}
            tx.execute("UPDATE lots SET quantity=0 WHERE id=?",[lot]).map_err(err)?;
            tx.execute("UPDATE products SET stock=stock-? WHERE id=?",params![qty,product]).map_err(err)?;
            tx.execute("INSERT INTO losses(id,product,quantity,cost,reason,user_id) VALUES(?,?,?,?,?,?)",params![uuid::Uuid::new_v4().to_string(),product,qty,(qty*cost+500)/1000,reason,actor.id]).map_err(err)?;
            tx.execute("INSERT INTO inventory(product,quantity,note) VALUES(?,?,?)",params![product,-qty,format!("Merma de lote {}: {}",lot,reason)]).map_err(err)?;
            json!({"type":"lot.discarded","lot":lot,"quantity":qty,"reason":reason})
        },
        Edit::Promotion{name,product,percent,starts,ends}=>{
            valid_date(&tx,&starts)?;valid_date(&tx,&ends)?;
            if name.trim().is_empty()||name.len()>100||!(1..=9500).contains(&percent)||starts>ends{return Err("Promoción inválida: descuento de 0.01 a 95% y fechas ordenadas".into());}
            tx.execute("INSERT INTO promotions(name,product,percent,starts,ends) VALUES(?,?,?,?,?)",params![name.trim(),product,percent,starts,ends]).map_err(err)?;
            json!({"type":"promotion.created","product":product,"percent":percent})
        },
        Edit::Toggle{id,enabled}=>{tx.execute("UPDATE promotions SET enabled=? WHERE id=?",params![enabled,id]).map_err(err)?;json!({"type":"promotion.changed","id":id,"enabled":enabled})}
    };
    security::audit(&tx,actor.id,event)?;tx.commit().map_err(err)
}
#[tauri::command]
pub fn advanced_list(store:State<Store>,session_token:String,section:String)->Result<Value> { advanced_list_service(&store, session_token, section) }
pub(crate) fn advanced_list_service(store:&Store, session_token:String,section:String)->Result<Value> {
    let db=store.db.lock().map_err(err)?;
    security::authorize(&store,&db,&session_token,if section=="lots"{"inventory.view"}else{"promotions.manage"})?;
    if section=="lots"{Ok(json!({"rows":rows(&db,"SELECT l.*,p.name,p.unit,CAST(julianday(expires)-julianday(date('now','localtime')) AS INTEGER) AS days FROM lots l JOIN products p ON p.id=l.product WHERE l.quantity>0 ORDER BY expires,p.name")?}))}
    else {Ok(json!({"rows":rows(&db,"SELECT t.*,p.name AS product_name,CASE WHEN t.enabled=0 THEN 'Pausada' WHEN t.starts>date('now','localtime') THEN 'Programada' WHEN t.ends<date('now','localtime') THEN 'Finalizada' ELSE 'Activa' END AS status FROM promotions t JOIN products p ON p.id=t.product ORDER BY t.id DESC")?}))}
}

#[derive(Deserialize)]
pub struct ReportFilter{from:String,to:String,cashier:Option<i64>,product:Option<i64>,category:Option<String>,method:Option<String>,#[serde(default)] products:Option<Vec<i64>>}
#[tauri::command]
pub fn filtered_report(store:State<Store>,session_token:String,filter:ReportFilter)->Result<Value> { filtered_report_service(&store, session_token, filter) }
pub(crate) fn filtered_report_service(store:&Store, session_token:String,filter:ReportFilter)->Result<Value> {
    let db=store.db.lock().map_err(err)?;
    let actor=security::authorize(&store,&db,&session_token,"reports.view")?;
    valid_date(&db,&filter.from)?;valid_date(&db,&filter.to)?;
    if filter.from>filter.to{return Err("La fecha inicial debe ser anterior a la final".into());}
    if filter.method.as_deref().is_some_and(|m|!["cash","card","credit","transfer","voucher","check","usd"].contains(&m)){return Err("Medio de pago inválido".into());}
    let product_scope=filter.products.as_ref().map(|ids|serde_json::to_string(ids)).transpose().map_err(err)?;
    let sql="WITH events AS (
      SELECT s.id,s.created,s.user_id,s.receipt,1 AS sign FROM sales s
      UNION ALL SELECT s.id,r.created,r.user_id,r.receipt,-1 FROM refunds r JOIN sales s ON s.id=r.sale
    ) SELECT e.id,e.created,coalesce(u.name,'Histórico'),e.sign,
      sum(CAST(json_extract(j.value,'$.subtotal') AS INTEGER)),
      sum(coalesce(CAST(json_extract(j.value,'$.cost') AS INTEGER),0)),
      sum(CASE WHEN coalesce(json_extract(j.value,'$.cost_known'),json_extract(j.value,'$.cost')>0,0)=0 THEN 1 ELSE 0 END),strftime('%H',e.created,'localtime'),
      EXISTS(SELECT 1 FROM payments WHERE sale=e.id AND method='cash' AND amount>0),
      EXISTS(SELECT 1 FROM payments WHERE sale=e.id AND method='card' AND amount>0),
      EXISTS(SELECT 1 FROM payments WHERE sale=e.id AND method='credit' AND amount>0),
      EXISTS(SELECT 1 FROM payments WHERE sale=e.id AND method='transfer' AND amount>0),
      EXISTS(SELECT 1 FROM payments WHERE sale=e.id AND method='voucher' AND amount>0),
      EXISTS(SELECT 1 FROM payments WHERE sale=e.id AND method='check' AND amount>0),
      EXISTS(SELECT 1 FROM payments WHERE sale=e.id AND method='usd' AND amount>0),
      coalesce((SELECT sum(amount) FROM payments WHERE sale=e.id AND method='cash'),0),
      coalesce((SELECT sum(amount) FROM payments WHERE sale=e.id AND method='card'),0),
      coalesce((SELECT sum(amount) FROM payments WHERE sale=e.id AND method='credit'),0),
      coalesce((SELECT sum(amount) FROM payments WHERE sale=e.id AND method='transfer'),0),
      coalesce((SELECT sum(amount) FROM payments WHERE sale=e.id AND method='voucher'),0),
      coalesce((SELECT sum(amount) FROM payments WHERE sale=e.id AND method='check'),0),
      coalesce((SELECT sum(amount) FROM payments WHERE sale=e.id AND method='usd'),0)
    FROM events e,json_each(e.receipt,'$.items') j
    LEFT JOIN users u ON u.id=e.user_id
    LEFT JOIN products p ON p.id=json_extract(j.value,'$.id')
    WHERE date(e.created,'localtime') BETWEEN ?1 AND ?2
      AND (?3 IS NULL OR e.user_id=?3) AND (?4 IS NULL OR p.id=?4)
      AND (?5 IS NULL OR coalesce(json_extract(j.value,'$.category'),p.category)=?5)
      AND (?6 IS NULL OR EXISTS(SELECT 1 FROM payments WHERE sale=e.id AND method=?6 AND amount>0))
      AND (?7 IS NULL OR p.id IN (SELECT value FROM json_each(?7)))
    GROUP BY e.id,e.created,e.sign ORDER BY e.created DESC";
    let mut stmt=db.prepare(sql).map_err(err)?;
    let mut cursor=stmt.query(params![filter.from,filter.to,filter.cashier,filter.product,filter.category,filter.method,product_scope]).map_err(err)?;
    let mut hours=std::collections::BTreeMap::<String,i64>::new();let mut methods=[0i64;7];let mut received=[0i64;7];
    let mut entries=Vec::new();let(mut revenue,mut cost,mut missing,mut sales,mut refunds)=(0i64,0i64,0i64,0i64,0i64);
    while let Some(row)=cursor.next().map_err(err)? {
        let sign:i64=row.get(3).map_err(err)?;let amount:i64=row.get(4).map_err(err)?;let item_cost:i64=row.get(5).map_err(err)?;
        revenue+=sign*amount;cost+=sign*item_cost;missing+=row.get::<_,i64>(6).map_err(err)?;
        if sign>0{for (i,total) in received.iter_mut().enumerate(){*total+=row.get::<_,i64>(15+i).map_err(err)?;}sales+=1;*hours.entry(row.get::<_,String>(7).map_err(err)?).or_default()+=1;for (i,count) in methods.iter_mut().enumerate(){*count+=row.get::<_,i64>(8+i).map_err(err)?;}}else{refunds+=1;}
        if entries.len()<500{entries.push(json!({"id":row.get::<_,String>(0).map_err(err)?,"created":row.get::<_,String>(1).map_err(err)?,"cashier":row.get::<_,String>(2).map_err(err)?,"refund":sign<0,"total":sign*amount}));}
    }
    let losses: Option<i64> = if actor.can("costs.view") && filter.method.is_none() {
        Some(db.query_row("SELECT coalesce(sum(l.cost),0) FROM losses l JOIN products p ON p.id=l.product WHERE date(l.created,'localtime') BETWEEN ?1 AND ?2 AND (?3 IS NULL OR l.user_id=?3) AND (?4 IS NULL OR l.product=?4) AND (?5 IS NULL OR p.category=?5) AND (?6 IS NULL OR p.id IN (SELECT value FROM json_each(?6)))", params![filter.from, filter.to, filter.cashier, filter.product, filter.category, product_scope], |r| r.get(0)).map_err(err)?)
    } else {
        None
    };
    let hours_data: Vec<_> = hours.into_iter().map(|(hour,tickets)|json!({"hour":hour,"tickets":tickets})).collect();
    let method_names = ["Efectivo","Tarjeta","Fiado","Transferencia","Vale","Cheque","Dólares (equivalente MXN)"];
    let methods_data: Vec<_> = method_names.iter().enumerate().map(|(i,name)|json!({"name":name,"tickets":methods[i],"received":received[i]})).collect();
    let mut top_stmt=db.prepare("SELECT coalesce(json_extract(j.value,'$.name'),p.name,'Producto'),coalesce(json_extract(j.value,'$.unit'),p.unit,'pieza'),sum(CAST(json_extract(j.value,'$.quantity') AS INTEGER)),sum(CAST(json_extract(j.value,'$.subtotal') AS INTEGER)) FROM sales s,json_each(s.receipt,'$.items') j LEFT JOIN products p ON p.id=json_extract(j.value,'$.id') WHERE date(s.created,'localtime') BETWEEN ?1 AND ?2 AND (?3 IS NULL OR s.user_id=?3) AND (?4 IS NULL OR p.id=?4) AND (?5 IS NULL OR coalesce(json_extract(j.value,'$.category'),p.category)=?5) AND (?6 IS NULL OR EXISTS(SELECT 1 FROM payments WHERE sale=s.id AND method=?6 AND amount>0)) AND (?7 IS NULL OR p.id IN (SELECT value FROM json_each(?7))) GROUP BY json_extract(j.value,'$.id'),1,2 ORDER BY 4 DESC,1 LIMIT 3").map_err(err)?;
    let top=top_stmt.query_map(params![filter.from,filter.to,filter.cashier,filter.product,filter.category,filter.method,product_scope],|row|Ok(json!({"name":row.get::<_,String>(0)?,"unit":row.get::<_,String>(1)?,"quantity":row.get::<_,i64>(2)?,"total":row.get::<_,i64>(3)?}))).map_err(err)?.collect::<std::result::Result<Vec<_>,_>>().map_err(err)?;
    let cashiers = rows(&db,"SELECT id,name FROM users ORDER BY name")?;
    Ok(json!({"top":top,"hours":hours_data,"methods":methods_data,"losses":losses,"revenue":revenue,"cost":if actor.can("costs.view"){Some(cost)}else{None},"missing":missing,"sales":sales,"refunds":refunds,"entries":entries,"cashiers":cashiers}))
}

