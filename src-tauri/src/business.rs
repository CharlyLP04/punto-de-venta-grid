use crate::{err,rows,positive,valid_ticket,setting,active,cash,Result,Store,security::{self,Actor}};
use rusqlite::{params,Connection};
use serde::{Deserialize,Serialize};
use serde_json::{json,Value};
use std::collections::BTreeMap;
use tauri::State;
use uuid::Uuid;

pub fn owned_shift(db:&Connection,actor:&Actor)->Result<i64> {
    let shift=active(db)?;
    let owner:Option<i64>=db.query_row("SELECT user_id FROM shifts WHERE id=?",[shift],|r|r.get(0)).map_err(err)?;
    if owner!=Some(actor.id){return Err("El turno pertenece a otro cajero; debe cerrarlo antes del relevo".into());}
    Ok(shift)
}
pub fn quote(db:&Connection,ticket:i64)->Result<Value> {
    valid_ticket(ticket)?;
    let mut stmt=db.prepare("SELECT p.id,p.name,p.price,p.cost,p.unit,c.quantity,c.override_price,p.wholesale_quantity,p.wholesale_price,c.discount_authorized_by,p.cost_known FROM cart c JOIN products p ON p.id=c.product WHERE c.ticket=? ORDER BY c.rowid").map_err(err)?;
    let mut cursor=stmt.query([ticket]).map_err(err)?;
    let mut items=Vec::new();let mut total=0i64;let mut consumption:BTreeMap<i64,i64>=BTreeMap::new();
    while let Some(row)=cursor.next().map_err(err)? {
        let id:i64=row.get(0).map_err(err)?;let name:String=row.get(1).map_err(err)?;
        let retail:i64=row.get(2).map_err(err)?;let cost:i64=row.get(3).map_err(err)?;
        let unit:String=row.get(4).map_err(err)?;let quantity:i64=row.get(5).map_err(err)?;
        let override_price:Option<i64>=row.get(6).map_err(err)?;let threshold:i64=row.get(7).map_err(err)?;let wholesale:i64=row.get(8).map_err(err)?;
        if quantity<=0||quantity>1_000_000{return Err("Cantidad fuera de rango".into());}
        let base=if threshold>0&&quantity>=threshold{wholesale}else{retail};
        let effective=base.min(crate::advanced::promo_price(db,id,retail)?);
        if let Some(value)=override_price { let author:Option<i64>=row.get(9).map_err(err)?;crate::advanced::check_discount(db,author.ok_or("Vuelve a autorizar el precio especial de este ticket")?,value,effective)?; }
        let price=override_price.unwrap_or(effective);
        positive(price)?;
        let subtotal=(price*quantity+500)/1000;
        let mut component_stmt=db.prepare("SELECT c.product,c.quantity,p.cost,p.cost_known FROM combo_items c JOIN products p ON p.id=c.product WHERE c.combo=?").map_err(err)?;
        let components=component_stmt.query_map([id],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,i64>(1)?,r.get::<_,i64>(2)?,r.get::<_,bool>(3)?))).map_err(err)?.collect::<std::result::Result<Vec<_>,_>>().map_err(err)?;
        let mut line_cost=0; let mut cost_known:bool=row.get(10).map_err(err)?;
        if components.is_empty(){*consumption.entry(id).or_default()+=quantity;line_cost=(cost*quantity+500)/1000;}
        else {cost_known=true; for (component,qty,component_cost,known) in components {
            cost_known &= known;
            if qty*quantity%1000!=0{return Err("El combo requiere cantidades completas".into());}
            let used=qty*quantity/1000;*consumption.entry(component).or_default()+=used;line_cost+=(component_cost*used+500)/1000;
        }}
        total=total.checked_add(subtotal).ok_or("Total fuera de rango")?;
        items.push(json!({"id":id,"name":name,"price":price,"quantity":quantity,"unit":unit,"subtotal":subtotal,"cost":if cost_known{Some(line_cost)}else{None},"cost_known":cost_known,"category":db.query_row("SELECT category FROM products WHERE id=?",[id],|r|r.get::<_,String>(0)).map_err(err)?}));
    }
    for item in crate::rows(db,&format!("SELECT -id AS id,name,quantity,price,cost,'pieza' AS unit,'Productos comunes' AS category,1 AS common FROM common_cart WHERE ticket={} ORDER BY id",ticket))? {
        let mut item=item;
        let quantity=item["quantity"].as_i64().ok_or("Cantidad inválida")?;
        let subtotal=(item["price"].as_i64().ok_or("Precio inválido")?*quantity+500)/1000;
        let unit_cost=item["cost"].as_i64();
        item["cost_known"]=json!(unit_cost.is_some());
        item["cost"]=json!(unit_cost.map(|c|(c*quantity+500)/1000));
        item["subtotal"]=json!(subtotal);
        total=total.checked_add(subtotal).ok_or("Total fuera de rango")?;
        items.push(item);
    }
    if items.is_empty()||total<=0||total>100_000_000{return Err("Ticket vacío o importe fuera de rango".into());}
    let mut stock_receipt=Vec::new();
    for (product,qty) in &consumption {
        let (stock,name,unit_cost):(i64,String,i64)=db.query_row("SELECT stock-coalesce((SELECT sum(quantity) FROM lots WHERE product=p.id AND expires<date('now','localtime')),0),name,cost FROM products p WHERE id=?",[product],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).map_err(err)?;
        if *qty>stock{return Err(format!("Existencias insuficientes: {}",name));}
        stock_receipt.push(json!({"id":product,"quantity":qty,"cost":(unit_cost*qty+500)/1000}));
    }
    Ok(json!({"total":total,"items":items,"consumption":stock_receipt}))
}
#[derive(Deserialize)]
pub struct Tender {pub cash:i64,pub card:i64,pub credit:i64,pub reference:String,#[serde(default)] pub transfer:i64,#[serde(default)] pub voucher:i64,#[serde(default)] pub check:i64,#[serde(default)] pub usd:i64,#[serde(default)] pub usd_units:i64,#[serde(default)] pub usd_rate:i64}
#[tauri::command]
pub fn checkout(store:State<Store>,session_token:String,ticket:i64,request_id:String,received:i64,customer:Option<i64>,tender:Option<Tender>)->Result<Value> { checkout_service(&store, session_token, ticket, request_id, received, customer, tender) }
pub(crate) fn checkout_service(store:&Store, session_token:String,ticket:i64,request_id:String,received:i64,customer:Option<i64>,tender:Option<Tender>)->Result<Value> {
    Uuid::parse_str(&request_id).map_err(err)?;
    let mut db=store.db.lock().map_err(err)?;
    let actor=security::authorize(&store,&db,&session_token,"sales.create")?;
    checkout_transaction(&mut db,&actor,ticket,request_id,received,customer,tender)
}

pub(crate) fn checkout_transaction(db:&mut Connection,actor:&Actor,ticket:i64,request_id:String,received:i64,customer:Option<i64>,tender:Option<Tender>)->Result<Value> {
    actor.require("sales.create")?;
    let tx=db.transaction().map_err(err)?;
    if let Ok((owner,receipt))=tx.query_row("SELECT user_id,receipt FROM sales WHERE id=?",[&request_id],|r|Ok((r.get::<_,Option<i64>>(0)?,r.get::<_,String>(1)?))){
        let owner_register:i64=tx.query_row("SELECT sh.register_id FROM sales s JOIN shifts sh ON sh.id=s.shift WHERE s.id=?",[&request_id],|r|r.get(0)).map_err(err)?;if owner!=Some(actor.id)||owner_register!=crate::network::register(){return Err("Folio de otro usuario o caja".into());} let mut value:Value=serde_json::from_str(&receipt).map_err(err)?;sanitize_receipt(&mut value);return Ok(value);
    }
    let shift=owned_shift(&tx,&actor)?;
    let mut receipt=quote(&tx,ticket)?;
    let total=receipt["total"].as_i64().ok_or("Total inválido")?;
    let split=tender.unwrap_or(Tender{cash:if customer.is_none(){total}else{0},card:0,credit:if customer.is_some(){total}else{0},reference:String::new(),transfer:0,voucher:0,check:0,usd:0,usd_units:0,usd_rate:0});
    if [split.cash,split.card,split.credit,split.transfer,split.voucher,split.check,split.usd,split.usd_units,received].iter().any(|n|*n<0||*n>100_000_000)||split.cash+split.card+split.credit+split.transfer+split.voucher+split.check+split.usd!=total{return Err("Los medios de pago deben sumar exactamente el total".into());}
    if received<split.cash{return Err("Efectivo recibido insuficiente".into());}
    if (split.card+split.transfer+split.voucher+split.check)>0&&(split.reference.trim().is_empty()||split.reference.len()>100){return Err("Confirma el pago e indica referencia, folio de vale o cheque".into());}
    let foreign_change=if split.usd>0 {
        if split.usd!=total||split.usd_rate<=0||split.usd_rate>100000{return Err("Los dólares requieren un pago completo y un tipo de cambio válido".into());}
        let equivalent=(split.usd_units*split.usd_rate+50)/100;
        if equivalent<total{return Err("Dólares recibidos insuficientes".into());}
        let change=equivalent-total;
        if cash(&tx,shift)?<change{return Err("No hay pesos suficientes en el cajón para dar cambio".into());}
        if change>0{tx.execute("INSERT INTO movements(shift,amount,note,user_id) VALUES(?,?,?,?)",params![shift,-change,format!("Cambio en pesos por dólares · {}",request_id),actor.id]).map_err(err)?;}
        change
    }else{if split.usd_units!=0||split.usd_rate!=0{return Err("Datos de dólares sin pago en dólares".into());}0};
    if let Some(id)=customer{let valid:i64=tx.query_row("SELECT count(*) FROM customers WHERE id=? AND enabled=1",[id],|r|r.get(0)).map_err(err)?;if valid==0{return Err("Cliente no disponible".into());}}
    if split.credit>0 {
        actor.require("credit.use")?;
        let id=customer.ok_or("Selecciona un cliente para el fiado")?;
        if tx.execute("UPDATE customers SET balance=balance+? WHERE id=? AND enabled=1 AND credit_enabled=1 AND balance+?<=credit_limit",params![split.credit,id,split.credit]).map_err(err)?==0{return Err("Cliente inexistente o límite de crédito excedido".into());}
        tx.execute("INSERT INTO ledger(customer,amount,note) VALUES(?,?,?)",params![id,split.credit,format!("Venta {}",request_id)]).map_err(err)?;
    }
    for item in receipt["consumption"].as_array().ok_or("Consumo inválido")? {
        let id=item["id"].as_i64().ok_or("Producto inválido")?;let qty=item["quantity"].as_i64().ok_or("Cantidad inválida")?;
        crate::advanced::consume_lots(&tx,id,qty,Some(&request_id),false)?;
        tx.execute("UPDATE products SET stock=stock-? WHERE id=?",params![qty,id]).map_err(err)?;
        tx.execute("INSERT INTO inventory(product,quantity,note) VALUES(?,?,?)",params![id,-qty,format!("Venta {}",request_id)]).map_err(err)?;
    }
    let payment=if split.credit==total{"credit"}else if split.cash==total{"cash"}else if split.card==total{"card"}else if split.transfer==total{"transfer"}else if split.voucher==total{"voucher"}else if split.check==total{"check"}else if split.usd==total{"usd"}else{"mixed"};
    receipt["register"]=json!(crate::network::register());receipt["id"]=json!(request_id);receipt["received"]=json!(received);receipt["change"]=json!(received-split.cash+foreign_change);receipt["payment"]=json!(payment);receipt["cashier"]=json!(actor.name);receipt["store"]=json!(setting(&tx,"store_name","Grid POS"));receipt["footer"]=json!(setting(&tx,"receipt_footer","Gracias por tu compra"));receipt["address"]=json!(setting(&tx,"store_address",""));receipt["phone"]=json!(setting(&tx,"store_phone",""));receipt["tender"]=json!({"cash":split.cash,"card":split.card,"credit":split.credit,"transfer":split.transfer,"voucher":split.voucher,"check":split.check,"usd":split.usd});receipt["foreign"]=json!({"units":split.usd_units,"rate":split.usd_rate});
    tx.execute("INSERT INTO sales(id,shift,total,payment,receipt,user_id,customer_id) VALUES(?,?,?,?,?,?,?)",params![request_id,shift,total,if split.credit==total{"credit"}else{"cash"},receipt.to_string(),actor.id,customer]).map_err(err)?;
    for (method,amount) in [("cash",split.cash),("card",split.card),("credit",split.credit),("transfer",split.transfer),("voucher",split.voucher),("check",split.check),("usd",split.usd)]{if amount>0{tx.execute("INSERT INTO payments(sale,method,amount,reference) VALUES(?,?,?,?)",params![request_id,method,amount,if ["card","transfer","voucher","check"].contains(&method){split.reference.as_str()}else{""}]).map_err(err)?;}}
    tx.execute("INSERT INTO outbox(id,kind,payload) VALUES(?,'sale.created',?)",params![request_id,receipt.to_string()]).map_err(err)?;
    tx.execute("DELETE FROM cart WHERE ticket=?",[ticket]).map_err(err)?;
    tx.execute("DELETE FROM common_cart WHERE ticket=?",[ticket]).map_err(err)?;
    security::audit(&tx,actor.id,json!({"type":"sale.created","id":request_id,"total":total,"tender":receipt["tender"]}))?;
    tx.commit().map_err(err)?;sanitize_receipt(&mut receipt);Ok(receipt)
}
fn sanitize_receipt(value:&mut Value){for key in ["items","consumption"]{if let Some(items)=value[key].as_array_mut(){for item in items{if let Some(object)=item.as_object_mut(){object.remove("cost");}}}}}

#[derive(Deserialize,Serialize)]
pub struct PurchaseLine {product:i64,quantity:i64,cost:i64,#[serde(default)] lot:String,#[serde(default)] expires:String}
#[derive(Deserialize,Serialize)]
pub struct Component {product:i64,quantity:i64}
#[derive(Deserialize,Serialize)]
#[serde(tag="type",rename_all="snake_case")]
pub enum Operation {
    Count{product:i64,expected:i64,counted:i64,reason:String},
    Rules{product:i64,minimum:i64,target:i64,wholesale_quantity:i64,wholesale_price:i64,favorite:bool},
    Alias{product:i64,code:String},
    Combo{product:i64,components:Vec<Component>},
    Discount{ticket:i64,product:i64,price:Option<i64>,reason:String},
    Purchase{supplier:String,folio:String,lines:Vec<PurchaseLine>,pay_cash:bool},
    Loss{product:i64,quantity:i64,reason:String},
    Refund{sale:String,reason:String,card_refunded:bool,restock:bool},
    Customize{store_name:String,address:String,phone:String,footer:String,accent:String,density:String,idle_minutes:i64,daily_goal:i64},
}
#[tauri::command]
pub fn operate(store:State<Store>,session_token:String,request_id:String,operation:Operation,approval_token:Option<String>)->Result<Value> { operate_service(&store, session_token, request_id, operation, approval_token) }
pub(crate) fn operate_service(store:&Store, session_token:String,request_id:String,operation:Operation,approval_token:Option<String>)->Result<Value> {
    Uuid::parse_str(&request_id).map_err(err)?;
    let mut db=store.db.lock().map_err(err)?;
    let permission=match &operation {Operation::Count{..}=>"inventory.count",Operation::Discount{..}=>"sales.discount",Operation::Refund{..}=>"sales.refund",Operation::Customize{..}=>"settings.manage",Operation::Purchase{..}=>"purchases.create",Operation::Loss{..}=>"inventory.loss",Operation::Rules{..}=>"inventory.rules",Operation::Alias{..}=>"inventory.codes",Operation::Combo{..}=>"inventory.combos"};
    let actor=security::authorize(&store,&db,&session_token,"")?;
    let body=serde_json::to_string(&operation).map_err(err)?;
    if let Ok((owner,previous,result))=db.query_row("SELECT user_id,body,response FROM requests WHERE id=?",[&request_id],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?))){if owner!=actor.id||previous!=body{return Err("Solicitud reutilizada con otros datos".into());}return serde_json::from_str(&result).map_err(err);}
    let approved_by=if let Some(nonce)=approval_token{
        if !["sales.discount","sales.refund"].contains(&permission){return Err("Esta operación no admite autorización puntual".into());}
        Some(security::consume_grant(&store,&db,&nonce,&session_token,&request_id,&body,permission)?)
    }else if actor.can(permission)||(actor.can("inventory.manage")&&["purchases.create","inventory.loss","inventory.rules","inventory.codes","inventory.combos"].contains(&permission)){None}else{return Err("Solicita autorización a un usuario con permiso".into());};
    let tx=db.transaction().map_err(err)?;
    let operation_value:Value=serde_json::from_str(&body).map_err(err)?;
    let before=security::audit_state(&tx,&operation_value)?;
    let mut result=json!({});
    match operation {
        Operation::Count{product,expected,counted,reason}=>{
            if counted<0||counted>100_000_000||reason.trim().is_empty()||reason.len()>200{return Err("Indica cantidad física y motivo válidos".into());}
            let (stock,unit,cost,combo):(i64,String,i64,i64)=tx.query_row("SELECT stock,unit,cost,(SELECT count(*) FROM combo_items WHERE combo=p.id) FROM products p WHERE id=?",[product],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))).map_err(err)?;
            if combo>0{return Err("Cuenta los componentes del combo".into());}
            if unit=="pieza"&&counted%1000!=0{return Err("Cuenta piezas enteras".into());}
            if stock!=expected{return Err("El inventario cambió durante el conteo. Actualiza y cuenta nuevamente antes de ajustar.".into());}
            let delta=counted-stock;
            if delta==0{return Err("El conteo coincide; no requiere ajuste".into());}
            // Avoid assigning a physical discrepancy to an arbitrary tracked lot.
            let tracked:i64=tx.query_row("SELECT coalesce(sum(quantity),0) FROM lots WHERE product=?",[product],|r|r.get(0)).map_err(err)?;
            if counted<tracked{return Err("El conteo es menor que el stock de lotes. Registra primero la diferencia en el lote correspondiente.".into());}
            tx.execute("UPDATE products SET stock=? WHERE id=?",params![counted,product]).map_err(err)?;
            tx.execute("INSERT INTO inventory(product,quantity,note) VALUES(?,?,?)",params![product,delta,format!("Conteo físico: {}",reason)]).map_err(err)?;
            if delta<0{tx.execute("INSERT INTO losses(id,product,quantity,cost,reason,user_id) VALUES(?,?,?,?,?,?)",params![request_id,product,-delta,(-delta*cost+500)/1000,format!("Faltante en conteo: {}",reason),actor.id]).map_err(err)?;}
            result=json!({"previous":stock,"counted":counted,"difference":delta});
        },
        Operation::Rules{product,minimum,target,wholesale_quantity,wholesale_price,favorite}=>{
            if minimum<0||target<minimum||target>1_000_000||wholesale_quantity<0||wholesale_quantity>1_000_000||wholesale_price<0||wholesale_price>100_000_000||(wholesale_quantity>0&&wholesale_price==0){return Err("Reglas fuera de rango".into());}
            let unit:String=tx.query_row("SELECT unit FROM products WHERE id=?",[product],|r|r.get(0)).map_err(err)?;
            if unit=="pieza"&&[minimum,target,wholesale_quantity].iter().any(|n|n%1000!=0){return Err("Las reglas por pieza requieren cantidades enteras".into());}
            tx.execute("UPDATE products SET minimum=?,target=?,wholesale_quantity=?,wholesale_price=?,favorite=? WHERE id=?",params![minimum,target,wholesale_quantity,wholesale_price,favorite,product]).map_err(err)?;
        },
        Operation::Alias{product,code}=>{if code.trim().is_empty()||code.len()>64{return Err("Código inválido".into());}tx.execute("INSERT INTO product_codes(code,product) VALUES(?,?)",params![code.trim(),product]).map_err(|_|"Código ya registrado o producto inválido".to_string())?;},
        Operation::Combo{product,components}=>{
            if components.is_empty()||components.len()>20{return Err("Define de 1 a 20 componentes".into());}
            let (unit,stock):(String,i64)=tx.query_row("SELECT unit,stock FROM products WHERE id=?",[product],|r|Ok((r.get(0)?,r.get(1)?))).map_err(err)?;
            if unit!="pieza"||stock!=0{return Err("El producto combo debe ser por pieza y tener stock propio cero".into());}
            let used:i64=tx.query_row("SELECT (SELECT count(*) FROM combo_items WHERE product=?1)+(SELECT count(*) FROM cart WHERE product=?1)",[product],|r|r.get(0)).map_err(err)?;
            if used>0{return Err("Retira el producto de tickets y otros combos antes de modificarlo".into());}
            tx.execute("DELETE FROM combo_items WHERE combo=?",[product]).map_err(err)?;
            for component in components {
                positive(component.quantity)?;
                let (unit,nested):(String,i64)=tx.query_row("SELECT unit,(SELECT count(*) FROM combo_items WHERE combo=p.id) FROM products p WHERE id=?",[component.product],|r|Ok((r.get(0)?,r.get(1)?))).map_err(err)?;
                if component.product==product||nested>0||component.quantity>1_000_000||(unit=="pieza"&&component.quantity%1000!=0){return Err("Componente inválido; no se admiten combos anidados".into());}
                tx.execute("INSERT INTO combo_items VALUES(?,?,?)",params![product,component.product,component.quantity]).map_err(err)?;
            }
        },
        Operation::Discount{ticket,product,price,reason}=>{
            owned_shift(&tx,&actor)?;valid_ticket(ticket)?;if reason.trim().is_empty()||reason.len()>200{return Err("Indica un motivo".into());}if let Some(p)=price{positive(p)?;}
            if let Some(value)=price {
                let author=approved_by.unwrap_or(actor.id);
                let (role,limit):(String,i64)=tx.query_row("SELECT role,discount_limit FROM users WHERE id=?",[author],|r|Ok((r.get(0)?,r.get(1)?))).map_err(err)?;
                let (retail,wholesale,threshold,qty):(i64,i64,i64,i64)=tx.query_row("SELECT p.price,p.wholesale_price,p.wholesale_quantity,c.quantity FROM products p JOIN cart c ON c.product=p.id WHERE c.ticket=? AND p.id=?",params![ticket,product],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))).map_err(err)?;
                let base=(if threshold>0&&qty>=threshold{wholesale}else{retail}).min(crate::advanced::promo_price(&tx,product,retail)?);
                if role!="owner"&&value*10000<base*(10000-limit){return Err(format!("Supera el límite de descuento de {}%. Solicita autorización del encargado.",limit as f64/100.0));}
            }
            if tx.execute("UPDATE cart SET override_price=?,reason=?,discount_authorized_by=? WHERE ticket=? AND product=?",params![price,reason,approved_by.unwrap_or(actor.id),ticket,product]).map_err(err)?==0{return Err("Selecciona una línea del ticket".into());}
        },
        Operation::Purchase{supplier,folio,lines,pay_cash}=>{
            actor.require("costs.view")?;
            if supplier.trim().is_empty()||supplier.len()>120||folio.len()>100||lines.is_empty()||lines.len()>200{return Err("Compra inválida".into());}
            let mut total=0;for line in &lines{positive(line.quantity)?;if line.quantity>1_000_000||line.cost<0||line.cost>100_000_000{return Err("Cantidad o costo inválido".into());}total+=(line.quantity*line.cost+500)/1000;}
            if total>100_000_000{return Err("Compra fuera de rango".into());}
            tx.execute("INSERT INTO purchases(id,user_id,supplier,folio,total) VALUES(?,?,?,?,?)",params![request_id,actor.id,supplier,folio,total]).map_err(err)?;
            for line in lines {
                let (stock,cost,unit,is_combo):(i64,i64,String,i64)=tx.query_row("SELECT stock,cost,unit,(SELECT count(*) FROM combo_items WHERE combo=p.id) FROM products p WHERE id=?",[line.product],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))).map_err(err)?;
                if is_combo>0||(unit=="pieza"&&line.quantity%1000!=0){return Err("Compra componentes del combo y usa piezas enteras".into());}
                let new_stock=stock.checked_add(line.quantity).ok_or("Stock fuera de rango")?;
                let weighted=(stock.checked_mul(cost).and_then(|n|n.checked_add(line.quantity*line.cost)).ok_or("Costo fuera de rango")?+new_stock/2)/new_stock;
                tx.execute("UPDATE products SET cost_known=CASE WHEN stock=0 THEN 1 ELSE cost_known END,stock=?,cost=? WHERE id=?",params![new_stock,weighted,line.product]).map_err(err)?;
                if !line.lot.is_empty()||!line.expires.is_empty() {
                    if line.lot.trim().is_empty()||line.lot.len()>80{return Err("Indica un lote de hasta 80 caracteres".into());}
                    crate::advanced::valid_date(&tx,&line.expires)?;
                    let mismatch:i64=tx.query_row("SELECT count(*) FROM lots WHERE product=? AND code=? AND expires<>?",params![line.product,line.lot.trim(),line.expires],|r|r.get(0)).map_err(err)?;
                    if mismatch>0{return Err("El lote existente tiene otra caducidad".into());}
                    tx.execute("INSERT INTO lots(product,code,expires,quantity) VALUES(?,?,?,?) ON CONFLICT(product,code) DO UPDATE SET quantity=quantity+excluded.quantity",params![line.product,line.lot.trim(),line.expires,line.quantity]).map_err(err)?;
                }
                tx.execute("INSERT INTO purchase_items VALUES(?,?,?,?)",params![request_id,line.product,line.quantity,line.cost]).map_err(err)?;
                tx.execute("INSERT INTO inventory(product,quantity,note) VALUES(?,?,?)",params![line.product,line.quantity,format!("Compra {} · {}",supplier,folio)]).map_err(err)?;
            }
            if pay_cash{actor.require("cash.move")?;let shift=owned_shift(&tx,&actor)?;if cash(&tx,shift)?<total{return Err("Efectivo insuficiente para pagar la compra".into());}tx.execute("INSERT INTO movements(shift,amount,note,user_id) VALUES(?,?,?,?)",params![shift,-total,format!("Compra {} · {}",supplier,folio),actor.id]).map_err(err)?;}
            result=json!({"total":total});
        },
        Operation::Loss{product,quantity,reason}=>{
            positive(quantity)?;if quantity>1_000_000||reason.trim().is_empty()||reason.len()>200{return Err("Indica cantidad y motivo válidos".into());}
            let (cost,unit):(i64,String)=tx.query_row("SELECT cost,unit FROM products WHERE id=?",[product],|r|Ok((r.get(0)?,r.get(1)?))).map_err(err)?;
            if unit=="pieza"&&quantity%1000!=0{return Err("Usa piezas enteras".into());}
            if tx.execute("UPDATE products SET stock=stock-? WHERE id=? AND stock>=?",params![quantity,product,quantity]).map_err(err)?==0{return Err("Existencias insuficientes".into());}
            crate::advanced::consume_lots(&tx,product,quantity,None,true)?;
            tx.execute("INSERT INTO losses(id,product,quantity,cost,reason,user_id) VALUES(?,?,?,?,?,?)",params![request_id,product,quantity,(cost*quantity+500)/1000,reason,actor.id]).map_err(err)?;
            tx.execute("INSERT INTO inventory(product,quantity,note) VALUES(?,?,?)",params![product,-quantity,format!("Merma: {}",reason)]).map_err(err)?;
        },
        Operation::Refund{sale,reason,card_refunded,restock}=>{
            let shift=owned_shift(&tx,&actor)?;
            if reason.trim().is_empty()||reason.len()>200{return Err("Indica el motivo de devolución".into());}
            let (raw,customer):(String,Option<i64>)=tx.query_row("SELECT receipt,customer_id FROM sales WHERE id=?",[&sale],|r|Ok((r.get(0)?,r.get(1)?))).map_err(err)?;
            let receipt:Value=serde_json::from_str(&raw).map_err(err)?;
            let tender=|method:&str|->Result<i64>{tx.query_row("SELECT coalesce(sum(amount),0) FROM payments WHERE sale=? AND method=?",params![sale,method],|r|r.get(0)).map_err(err)};
            let mut refund_cash=tender("cash")?+tender("usd")?;let credit=tender("credit")?;let card=tender("card")?+tender("transfer")?+tender("voucher")?+tender("check")?;
            if card>0&&!card_refunded{return Err("Confirma primero el reembolso externo de tarjeta, transferencia, vale o cheque".into());}
            if credit>0{let customer=customer.ok_or("Venta histórica sin cliente asociado; requiere conciliación del propietario")?;let balance:i64=tx.query_row("SELECT balance FROM customers WHERE id=?",[customer],|r|r.get(0)).map_err(err)?;let adjustment=balance.min(credit);refund_cash+=credit-adjustment;tx.execute("UPDATE customers SET balance=balance-? WHERE id=?",params![adjustment,customer]).map_err(err)?;tx.execute("INSERT INTO ledger(customer,amount,note) VALUES(?,?,?)",params![customer,-adjustment,format!("Devolución {}",sale)]).map_err(err)?;}
            if cash(&tx,shift)?<refund_cash{return Err("Efectivo insuficiente para el reembolso".into());}
            tx.execute("INSERT INTO refunds(id,sale,user_id,shift,reason,receipt) VALUES(?,?,?,?,?,?)",params![request_id,sale,actor.id,shift,reason,raw]).map_err(|_|"Esta venta ya fue devuelta o el folio no es válido".to_string())?;
            let consumed=receipt.get("consumption").unwrap_or(&receipt["items"]).as_array().ok_or("Recibo inválido")?;
            if restock {
            for item in consumed{let product=item["id"].as_i64().ok_or("Producto inválido")?;let qty=item["quantity"].as_i64().ok_or("Cantidad inválida")?;tx.execute("UPDATE products SET stock=stock+? WHERE id=?",params![qty,product]).map_err(err)?;tx.execute("INSERT INTO inventory(product,quantity,note) VALUES(?,?,?)",params![product,qty,format!("Devolución {}",sale)]).map_err(err)?;}
            tx.execute("UPDATE lots SET quantity=quantity+coalesce((SELECT quantity FROM sale_lots WHERE sale=?1 AND lot=lots.id),0) WHERE id IN (SELECT lot FROM sale_lots WHERE sale=?1)",[&sale]).map_err(err)?;
            } else {
                for item in consumed {
                    let product=item["id"].as_i64().ok_or("Producto inválido")?;
                    let qty=item["quantity"].as_i64().ok_or("Cantidad inválida")?;
                    let cost:i64=tx.query_row("SELECT cost FROM products WHERE id=?",[product],|r|r.get(0)).map_err(err)?;
                    let original_cost=item["cost"].as_i64().unwrap_or((cost*qty+500)/1000);
                    tx.execute("INSERT INTO losses(id,product,quantity,cost,reason,user_id) VALUES(?,?,?,?,?,?)",params![Uuid::new_v4().to_string(),product,qty,original_cost,format!("Devolución no vendible {}: {}",sale,reason),actor.id]).map_err(err)?;
                }
            }
            if refund_cash>0{tx.execute("INSERT INTO movements(shift,amount,note,user_id) VALUES(?,?,?,?)",params![shift,-refund_cash,format!("Reembolso {}",sale),actor.id]).map_err(err)?;}
            tx.execute("INSERT INTO outbox(id,kind,payload) VALUES(?,'sale.refunded',?)",params![request_id,json!({"sale":sale,"cash":refund_cash,"card":card,"credit":credit}).to_string()]).map_err(err)?;
            result=json!({"cash":refund_cash,"card":card,"credit":credit});
        },
        Operation::Customize{store_name,address,phone,footer,accent,density,idle_minutes,daily_goal}=>{
            if store_name.trim().is_empty()||store_name.len()>80||address.len()>180||phone.len()>30||footer.len()>160||!["classic","gold","green","blue","rose"].contains(&accent.as_str())||!["comfortable","compact"].contains(&density.as_str())||!(1..=120).contains(&idle_minutes)||daily_goal<0||daily_goal>100_000_000{return Err("Personalización fuera de rango".into());}
            // ESC/POS control bytes must never originate from editable receipt strings.
            if [&store_name,&address,&phone,&footer].iter().any(|s|s.chars().any(|c|c.is_control())){return Err("No se permiten caracteres de control en el ticket".into());}
            for (key,value) in [("store_name",store_name),("store_address",address),("store_phone",phone),("receipt_footer",footer),("accent",accent),("density",density),("idle_minutes",idle_minutes.to_string()),("daily_goal",daily_goal.to_string())]{tx.execute("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",params![key,value]).map_err(err)?;}
        },
    }
    security::audit(&tx,actor.id,json!({"type":"business.operation","request":request_id,"approved_by":approved_by,"before":before,"after":security::audit_state(&tx,&operation_value)?,"operation":operation_value}))?;
    tx.execute("INSERT INTO requests VALUES(?,?,?,?)",params![request_id,actor.id,body,result.to_string()]).map_err(err)?;
    tx.commit().map_err(err)?;Ok(result)
}

#[tauri::command]
pub fn management(store:State<Store>,session_token:String,section:String)->Result<Value> { management_service(&store, session_token, section) }
pub(crate) fn management_service(store:&Store, session_token:String,section:String)->Result<Value> {
    let db=store.db.lock().map_err(err)?;
    let permission=match section.as_str(){"audit"=>"audit.view","inventory"=>"inventory.view",_=>"reports.view"};
    let actor=security::authorize(&store,&db,&session_token,permission)?;
    match section.as_str(){
        "audit"=>{
            let mut events=rows(&db,"SELECT a.id,a.event,a.created,coalesce(u.name,'Histórico') AS user FROM audit a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 500")?;
            if !actor.can("costs.view") {
                // Audit visibility must not bypass permission to read purchase costs.
                for event in &mut events {
                    let detail=event["event"].as_str().and_then(|raw|serde_json::from_str::<Value>(raw).ok()).unwrap_or(Value::Null);
                    event["event"]=Value::String(json!({"type":detail["type"],"operation":detail["operation"]["type"],"approved_by":detail["approved_by"],"detail":"Detalle restringido: requiere permiso para consultar costos"}).to_string());
                }
            }
            Ok(json!({"events":events}))
        },
        "inventory"=>Ok(json!({"aliases":rows(&db,"SELECT * FROM product_codes ORDER BY product,code")?,"combos":rows(&db,"SELECT * FROM combo_items")?,"orders":rows(&db,"SELECT id,name,stock,minimum,target,max(0,target-stock) AS suggested FROM products WHERE stock<=minimum AND NOT EXISTS(SELECT 1 FROM combo_items WHERE combo=products.id) ORDER BY name")?,"purchases":if actor.can("costs.view"){rows(&db,"SELECT * FROM purchases ORDER BY created DESC LIMIT 100")?}else{vec![]}})),
        "reports"=>{
            actor.require("costs.view")?;
            Ok(json!({"summary":rows(&db,"SELECT coalesce(sum(revenue),0) AS revenue,coalesce(sum(cost),0) AS cost,(SELECT coalesce(sum(cost),0) FROM losses WHERE date(created,'localtime')=date('now','localtime')) AS losses,coalesce(sum(missing_cost),0) AS missing_cost FROM sale_metrics WHERE date(created,'localtime')=date('now','localtime')")?,"stars":rows(&db,"SELECT name,sum(margin) AS margin FROM item_metrics WHERE margin IS NOT NULL AND created>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 days') GROUP BY product ORDER BY margin DESC LIMIT 10")?,"ghosts":rows(&db,"SELECT p.id,p.name,p.stock FROM products p WHERE p.stock>0 AND p.created<strftime('%Y-%m-%dT%H:%M:%fZ','now','-45 days') AND NOT EXISTS(SELECT 1 FROM sales s,json_each(s.receipt,'$.items') j WHERE json_extract(j.value,'$.id')=p.id AND s.created>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-45 days'))")?,"hours":rows(&db,"SELECT strftime('%H',created,'localtime') AS hour,count(*) AS tickets,sum(total) AS total FROM sales WHERE date(created,'localtime')=date('now','localtime') AND NOT EXISTS(SELECT 1 FROM refunds WHERE sale=sales.id) GROUP BY hour ORDER BY hour")?}))
        },
        "cut_x"=>{let shift=active(&db)?;Ok(json!({"shift":shift,"expected":cash(&db,shift)?,"payments":rows(&db,&format!("SELECT p.method,sum(p.amount) AS amount FROM payments p JOIN sales s ON s.id=p.sale WHERE s.shift={} GROUP BY p.method",shift))?,"movements":rows(&db,&format!("SELECT amount,note FROM movements WHERE shift={}",shift))?}))},
        _=>Err("Sección desconocida".into())
    }
}



