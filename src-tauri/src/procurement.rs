use crate::{err,rows,security,business,Result,Store};
use rusqlite::params;
use serde::{Deserialize,Serialize};
use serde_json::{json,Value};
use tauri::State;

#[derive(Serialize,Deserialize)]
pub struct Line{product:i64,quantity:i64,cost:i64}
#[derive(Serialize,Deserialize)]
pub struct DeliveryLine { product:i64, quantity:i64, cost:i64, expected_price:i64, price:Option<i64>, #[serde(default)] lot:String, #[serde(default)] expires:String }
#[derive(Serialize,Deserialize)]
#[serde(tag="type",rename_all="snake_case")]
pub enum Action{
    Supplier{id:Option<i64>,name:String,phone:String,email:String,notes:String,enabled:bool},
    Order{supplier:i64,lines:Vec<Line>,note:String,#[serde(default)] budget:Option<i64>},
    Deliver{id:String,expected_body:String,lines:Vec<DeliveryLine>,pay_cash:bool,close_remaining:bool,note:String},
    Receive{id:String,pay_cash:bool},
    Cancel{id:String,reason:String},
}
#[tauri::command]
pub fn procurement_list(store:State<Store>,session_token:String)->Result<Value> { procurement_list_service(&store, session_token) }
pub(crate) fn procurement_list_service(store:&Store, session_token:String)->Result<Value> {
    let db=store.db.lock().map_err(err)?;let actor=security::authorize(&store,&db,&session_token,"")?;
    if !actor.can("inventory.manage"){actor.require("purchases.create")?;}
    actor.require("costs.view")?;
    Ok(json!({"suppliers":rows(&db,"SELECT s.*,(SELECT count(*) FROM purchase_orders o WHERE o.supplier=s.id AND o.status='draft') AS pending FROM suppliers s ORDER BY name")?,"orders":rows(&db,"SELECT o.*,s.name AS supplier_name FROM purchase_orders o JOIN suppliers s ON s.id=o.supplier ORDER BY o.created DESC LIMIT 200")?}))
}
#[tauri::command]
pub fn procurement_save(store:State<Store>,session_token:String,request_id:String,action:Action)->Result<Value> { procurement_save_service(&store, session_token, request_id, action) }
pub(crate) fn procurement_save_service(store:&Store, session_token:String,request_id:String,action:Action)->Result<Value> {
    uuid::Uuid::parse_str(&request_id).map_err(err)?;
    let mut db=store.db.lock().map_err(err)?;let actor=security::authorize(&store,&db,&session_token,"")?;
    if !actor.can("inventory.manage"){actor.require("purchases.create")?;}actor.require("costs.view")?;
    let body=format!("procurement:{}",serde_json::to_string(&action).map_err(err)?);
    let tx=db.transaction().map_err(err)?;
    if let Ok((owner,previous,response))=tx.query_row("SELECT user_id,body,response FROM requests WHERE id=?",[&request_id],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?))){if owner!=actor.id||body!=previous{return Err("Solicitud reutilizada".into());}return serde_json::from_str(&response).map_err(err);}
    let mut response=json!({});
    match action{
        Action::Supplier{id,name,phone,email,notes,enabled}=>{
            if name.trim().is_empty()||name.len()>120||phone.len()>30||email.len()>120||notes.len()>1000{return Err("Datos de proveedor inválidos".into());}
            if let Some(id)=id{if tx.execute("UPDATE suppliers SET name=?,phone=?,email=?,notes=?,enabled=? WHERE id=?",params![name.trim(),phone,email,notes,enabled,id]).map_err(err)?!=1{return Err("Proveedor inexistente".into());}}
            else{tx.execute("INSERT INTO suppliers(name,phone,email,notes,enabled) VALUES(?,?,?,?,?)",params![name.trim(),phone,email,notes,enabled]).map_err(err)?;response=json!({"id":tx.last_insert_rowid()});}
        },
        Action::Order{supplier,lines,note,budget}=>{
            if lines.is_empty()||lines.len()>200||note.len()>500{return Err("Orden inválida".into());}
            let enabled:i64=tx.query_row("SELECT enabled FROM suppliers WHERE id=?",[supplier],|r|r.get(0)).map_err(err)?;if enabled!=1{return Err("Proveedor archivado".into());}
            let mut seen=std::collections::BTreeSet::new();let mut total=0i64;
            for line in &lines{
                if line.quantity<=0||line.quantity>1_000_000||line.cost<0||line.cost>100_000_000||!seen.insert(line.product){return Err("Cantidades, costos o productos repetidos inválidos".into());}
                let (unit,combo):(String,i64)=tx.query_row("SELECT unit,(SELECT count(*) FROM combo_items WHERE combo=p.id) FROM products p WHERE id=? AND enabled=1",[line.product],|r|Ok((r.get(0)?,r.get(1)?))).map_err(err)?;
                if combo>0||(unit=="pieza"&&line.quantity%1000!=0){return Err("Usa piezas enteras y compra los componentes del combo".into());}
                total+=(line.quantity*line.cost+500)/1000;
            }
            if total>100_000_000{return Err("Orden fuera de rango".into());}
            if let Some(limit)=budget {if limit<=0||limit>100_000_000||total>limit{return Err("El pedido supera el presupuesto disponible".into());}}
            tx.execute("INSERT INTO purchase_orders(id,supplier,status,body,user_id) VALUES(?,?,'draft',?,?)",params![request_id,supplier,json!({"lines":lines,"note":note,"total":total,"budget":budget}).to_string(),actor.id]).map_err(err)?;
            response=json!({"id":request_id,"total":total});
        },
        Action::Cancel{id,reason}=>{
            if reason.trim().is_empty()||reason.len()>200{return Err("Indica el motivo".into());}
            if tx.execute("UPDATE purchase_orders SET status='cancelled' WHERE id=? AND status='draft'",[id]).map_err(err)?!=1{return Err("Solo se cancelan órdenes pendientes".into());}
        },
        Action::Deliver{id,expected_body,lines,pay_cash,close_remaining,note}=>{
            if lines.len()>200||note.len()>500||(close_remaining&&note.trim().is_empty()){return Err("Indica el motivo si vas a cerrar cantidades pendientes".into());}
            let (raw,supplier):(String,String)=tx.query_row("SELECT o.body,s.name FROM purchase_orders o JOIN suppliers s ON s.id=o.supplier WHERE o.id=? AND o.status='draft'",[&id],|r|Ok((r.get(0)?,r.get(1)?))).map_err(|_|"El pedido ya no está pendiente".to_string())?;
            if raw!=expected_body{return Err("Otro usuario actualizó este pedido. Recarga antes de recibir".into());}
            let mut order:Value=serde_json::from_str(&raw).map_err(err)?;
            let planned=order["lines"].as_array_mut().ok_or("Pedido inválido")?;
            let mut seen=std::collections::BTreeSet::new();let mut total=0i64;let mut changes=Vec::new();
            for line in &lines {
                if line.quantity<=0||line.quantity>1_000_000||line.cost<0||line.cost>100_000_000||!seen.insert(line.product){return Err("Revisa cantidades y costos; no repitas productos".into());}
                let item=planned.iter_mut().find(|v|v["product"].as_i64()==Some(line.product)).ok_or("El producto no pertenece al pedido")?;
                let received=item["received"].as_i64().unwrap_or(0);
                if received+line.quantity>item["quantity"].as_i64().ok_or("Cantidad inválida")?{return Err("La recepción supera lo pendiente. Registra los extras en otro pedido".into());}
                let(stock,cost,price,unit,combo):(i64,i64,i64,String,i64)=tx.query_row("SELECT stock,cost,price,unit,(SELECT count(*) FROM combo_items WHERE combo=p.id) FROM products p WHERE id=? AND enabled=1",[line.product],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?))).map_err(err)?;
                if combo>0||(unit=="pieza"&&line.quantity%1000!=0){return Err("Usa piezas enteras y recibe componentes, no combos".into());}
                if price!=line.expected_price{return Err("Cambió un precio mientras revisabas. Recarga el pedido".into());}
                if stock<0{return Err("Corrige las existencias negativas del producto antes de recibir".into());}
                let qty=stock.checked_add(line.quantity).ok_or("Existencias fuera de rango")?;
                let weighted=stock.checked_mul(cost).and_then(|v|v.checked_add(line.quantity*line.cost)).and_then(|v|v.checked_add(qty/2)).ok_or("Costo fuera de rango")?/qty;
                tx.execute("UPDATE products SET cost_known=CASE WHEN stock=0 THEN 1 ELSE cost_known END,stock=?,cost=? WHERE id=?",params![qty,weighted,line.product]).map_err(err)?;
                if let Some(new_price)=line.price {
                    if !actor.can("inventory.manage"){actor.require("products.edit")?;}
                    if new_price<=0||new_price>100_000_000{return Err("Precio fuera de rango".into());}
                    tx.execute("UPDATE products SET price=? WHERE id=?",params![new_price,line.product]).map_err(err)?;
                    if new_price!=price{changes.push(json!({"product":line.product,"previous":price,"price":new_price}));}
                }
                if !line.lot.is_empty()||!line.expires.is_empty(){
                    if line.lot.trim().is_empty()||line.lot.len()>80{return Err("Indica un lote de hasta 80 caracteres".into());}
                    crate::advanced::valid_date(&tx,&line.expires)?;
                    let mismatch:i64=tx.query_row("SELECT count(*) FROM lots WHERE product=? AND code=? AND expires<>?",params![line.product,line.lot.trim(),line.expires],|r|r.get(0)).map_err(err)?;
                    if mismatch>0{return Err("Ese lote tiene otra caducidad".into());}
                    tx.execute("INSERT INTO lots(product,code,expires,quantity) VALUES(?,?,?,?) ON CONFLICT(product,code) DO UPDATE SET quantity=quantity+excluded.quantity",params![line.product,line.lot.trim(),line.expires,line.quantity]).map_err(err)?;
                }
                total+=(line.quantity*line.cost+500)/1000;
                item["received"]=json!(received+line.quantity);
                tx.execute("INSERT INTO inventory(product,quantity,note) VALUES(?,?,?)",params![line.product,line.quantity,format!("Entrega del proveedor · pedido {}",id)]).map_err(err)?;
            }
            if total>100_000_000|| (lines.is_empty()&&!close_remaining){return Err("Revisa el total e indica al menos una cantidad recibida".into());}
            let complete=planned.iter().all(|v|v["received"].as_i64().unwrap_or(0)>=v["quantity"].as_i64().unwrap_or(0));
            if !lines.is_empty(){
                tx.execute("INSERT INTO purchases(id,user_id,supplier,folio,total) VALUES(?,?,?,?,?)",params![request_id,actor.id,supplier,id,total]).map_err(err)?;
                for line in &lines{tx.execute("INSERT INTO purchase_items VALUES(?,?,?,?)",params![request_id,line.product,line.quantity,line.cost]).map_err(err)?;}
            }
            if pay_cash&&total>0{actor.require("cash.move")?;let shift=business::owned_shift(&tx,&actor)?;if crate::cash(&tx,shift)?<total{return Err("No alcanza el efectivo del cajón".into());}tx.execute("INSERT INTO movements(shift,amount,note,user_id) VALUES(?,?,?,?)",params![shift,-total,format!("Pago de entrega · pedido {}",id),actor.id]).map_err(err)?;}
            let receipt=json!({"id":request_id,"total":total,"lines":lines,"note":note,"pay_cash":pay_cash,"price_changes":changes,"closed_remaining":close_remaining,"created":tx.query_row("SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now')",[],|r|r.get::<_,String>(0)).map_err(err)?});
            if !order["receipts"].is_array(){order["receipts"]=json!([]);}
            order["receipts"].as_array_mut().ok_or("Historial inválido")?.push(receipt);
            tx.execute("UPDATE purchase_orders SET body=?,status=? WHERE id=?",params![order.to_string(),if complete||close_remaining{"received"}else{"draft"},id]).map_err(err)?;
            response=json!({"total":total,"complete":complete||close_remaining,"price_changes":changes});
        },
        Action::Receive{id,pay_cash}=>{
            let (raw,supplier):(String,String)=tx.query_row("SELECT o.body,s.name FROM purchase_orders o JOIN suppliers s ON s.id=o.supplier WHERE o.id=? AND o.status='draft'",[&id],|r|Ok((r.get(0)?,r.get(1)?))).map_err(|_|"La orden ya fue recibida o cancelada".to_string())?;
            let order:Value=serde_json::from_str(&raw).map_err(err)?;if order["receipts"].as_array().is_some_and(|v|!v.is_empty()){return Err("Continúa este pedido desde Recibir mercancía".into());}let lines:Vec<Line>=serde_json::from_value(order["lines"].clone()).map_err(err)?;let total=order["total"].as_i64().ok_or("Total inválido")?;
            tx.execute("INSERT INTO purchases(id,user_id,supplier,folio,total) VALUES(?,?,?,?,?)",params![request_id,actor.id,supplier,id,total]).map_err(err)?;
            for line in lines{
                let(stock,cost,unit,combo):(i64,i64,String,i64)=tx.query_row("SELECT stock,cost,unit,(SELECT count(*) FROM combo_items WHERE combo=p.id) FROM products p WHERE id=? AND enabled=1",[line.product],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))).map_err(err)?;
                if combo>0||(unit=="pieza"&&line.quantity%1000!=0){return Err("El producto cambió: revisa su unidad o componentes antes de recibir".into());}
                let qty=stock.checked_add(line.quantity).ok_or("Stock fuera de rango")?;
                let weighted=stock.checked_mul(cost).and_then(|v|v.checked_add(line.quantity*line.cost)).and_then(|v|v.checked_add(qty/2)).ok_or("Costo fuera de rango")?/qty;
                tx.execute("UPDATE products SET cost_known=CASE WHEN stock=0 THEN 1 ELSE cost_known END,stock=?,cost=? WHERE id=?",params![qty,weighted,line.product]).map_err(err)?;
                tx.execute("INSERT INTO purchase_items VALUES(?,?,?,?)",params![request_id,line.product,line.quantity,line.cost]).map_err(err)?;
                tx.execute("INSERT INTO inventory(product,quantity,note) VALUES(?,?,?)",params![line.product,line.quantity,format!("Recepción orden {}",id)]).map_err(err)?;
            }
            if pay_cash{actor.require("cash.move")?;let shift=business::owned_shift(&tx,&actor)?;if crate::cash(&tx,shift)?<total{return Err("Efectivo insuficiente".into());}tx.execute("INSERT INTO movements(shift,amount,note,user_id) VALUES(?,?,?,?)",params![shift,-total,format!("Pago orden {}",id),actor.id]).map_err(err)?;}
            tx.execute("UPDATE purchase_orders SET status='received' WHERE id=?",[id]).map_err(err)?;
        },
    }
    security::audit(&tx,actor.id,json!({"type":"procurement.saved","request":request_id,"operation":body}))?;
    tx.execute("INSERT INTO requests VALUES(?,?,?,?)",params![request_id,actor.id,body,response.to_string()]).map_err(err)?;
    tx.commit().map_err(err)?;Ok(response)
}
