use crate::{err,security,Result,Store};
use rusqlite::params;
use serde::Deserialize;
use serde_json::{json,Value};
use tauri::State;

#[derive(Deserialize)]
pub struct Filter { query:String,from:Option<String>,to:Option<String>,cashier:Option<i64>,product:Option<i64>,amount:Option<i64>,page:i64 }
#[tauri::command]
pub fn sale_history(store:State<Store>,session_token:String,filter:Filter)->Result<Value> { sale_history_service(&store, session_token, filter) }
pub(crate) fn sale_history_service(store:&Store, session_token:String,filter:Filter)->Result<Value> {
    let db=store.db.lock().map_err(err)?;
    let actor=security::authorize(&store,&db,&session_token,"")?;
    if !actor.can("sales.create")&&!actor.can("reports.view"){return Err("Sin permiso para consultar ventas".into());}
    if filter.query.len()>120||filter.page<0||filter.page>100000{return Err("Filtro fuera de rango".into());}
    if let Some(date)=&filter.from{crate::advanced::valid_date(&db,date)?;}
    if let Some(date)=&filter.to{crate::advanced::valid_date(&db,date)?;}
    if let (Some(from),Some(to))=(&filter.from,&filter.to){if from>to{return Err("Rango de fechas inválido".into());}}
    let own=if actor.can("reports.view"){None}else{Some(actor.id)};
    let conditions=" FROM sales s LEFT JOIN users u ON u.id=s.user_id LEFT JOIN customers c ON c.id=s.customer_id
      WHERE (?1 IS NULL OR s.user_id=?1)
      AND (?2='' OR instr(lower(s.id),lower(?2))>0 OR instr(lower(coalesce(c.name,'')),lower(?2))>0)
      AND (?3 IS NULL OR date(s.created,'localtime')>=?3) AND (?4 IS NULL OR date(s.created,'localtime')<=?4)
      AND (?5 IS NULL OR s.user_id=?5) AND (?6 IS NULL OR EXISTS(SELECT 1 FROM json_each(s.receipt,'$.items') j WHERE json_extract(j.value,'$.id')=?6))
      AND (?7 IS NULL OR s.total=?7)";
    let total:i64=db.query_row(&format!("SELECT count(*){}",conditions),params![own,filter.query,filter.from,filter.to,filter.cashier,filter.product,filter.amount],|r|r.get(0)).map_err(err)?;
    let mut stmt=db.prepare(&format!("SELECT s.id,s.total,s.created,coalesce(u.name,'Histórico'),coalesce(json_extract(s.receipt,'$.payment'),s.payment),s.print_status,EXISTS(SELECT 1 FROM refunds WHERE sale=s.id),coalesce(c.name,'Mostrador'),s.receipt{} ORDER BY s.rowid DESC LIMIT 40 OFFSET ?8",conditions)).map_err(err)?;
    let rows=stmt.query_map(params![own,filter.query,filter.from,filter.to,filter.cashier,filter.product,filter.amount,filter.page*40],|r|{
        let raw_receipt: Option<String> = r.get(8)?;
        let receipt_val: Value = raw_receipt.as_deref().and_then(|s| serde_json::from_str(s).ok()).unwrap_or(json!({}));
        Ok(json!({"id":r.get::<_,String>(0)?,"total":r.get::<_,i64>(1)?,"created":r.get::<_,String>(2)?,"cashier":r.get::<_,String>(3)?,"payment":r.get::<_,String>(4)?,"print_status":r.get::<_,String>(5)?,"refunded":r.get::<_,bool>(6)?,"customer":r.get::<_,String>(7)?,"receipt":receipt_val}))
    }).map_err(err)?.collect::<std::result::Result<Vec<_>,_>>().map_err(err)?;
    Ok(json!({"entries":rows,"total":total,"page":filter.page,"cashiers":if actor.can("reports.view"){crate::rows(&db,"SELECT id,name FROM users ORDER BY name")?}else{vec![]}}))
}
