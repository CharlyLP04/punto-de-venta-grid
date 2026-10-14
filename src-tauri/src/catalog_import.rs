use crate::{err,security,Result,Store};
use calamine::{Reader,Xlsx};
use rusqlite::{params,Connection};
use serde::{Deserialize,Serialize};
use serde_json::{json,Value};
use std::{collections::HashSet,io::Cursor};
use tauri::State;

#[derive(Deserialize,Serialize,Clone)]
pub struct ImportRow { pub code:String,pub name:String,pub category:String,pub unit:String,pub price:i64,pub cost:Option<i64> }
fn validate(db:&Connection,items:&[ImportRow],update:bool)->Result<Value>{
    if items.is_empty()||items.len()>10000{return Err("Selecciona entre 1 y 10,000 productos".into());}
    let mut seen=HashSet::new();let mut errors=vec![];let mut created=0;let mut updated=0;let mut skipped=0;
    for (i,p) in items.iter().enumerate(){
        let message=if p.code.trim().is_empty()||p.code.len()>64||p.name.trim().is_empty()||p.name.chars().count()>120||p.category.trim().is_empty()||p.category.len()>100||[&p.code,&p.name,&p.category].iter().any(|v|v.chars().any(char::is_control)){Some("Código, nombre o categoría inválidos")}
        else if !seen.insert(p.code.trim().to_owned()){Some("Código repetido en el archivo")}
        else if !["pieza","kg"].contains(&p.unit.as_str())||p.price<=0||p.price>100_000_000||p.cost.is_some_and(|c|!(0..=100_000_000).contains(&c)){Some("Unidad, precio o costo inválidos")}
        else{None};
        if let Some(message)=message{errors.push(json!({"row":i+2,"message":message}));continue;}
        let existing=db.query_row("SELECT id,unit FROM products WHERE code=?",[p.code.trim()],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,String>(1)?))).ok();
        if let Some((id,unit))=existing{
            if !update{skipped+=1;continue;}
            let used:i64=db.query_row("SELECT count(*) FROM cart WHERE product=?",[id],|r|r.get(0)).map_err(err)?;
            if unit!=p.unit{errors.push(json!({"row":i+2,"message":"La unidad difiere del catálogo; corrígela individualmente"}));}
            else if used>0{errors.push(json!({"row":i+2,"message":"Producto en un ticket abierto; termina esa venta antes de actualizar"}));}
            else{updated+=1;}
        }else{
            let alias:i64=db.query_row("SELECT count(*) FROM product_codes WHERE code=?",[p.code.trim()],|r|r.get(0)).map_err(err)?;
            if alias>0{errors.push(json!({"row":i+2,"message":"Este código ya es un código alterno"}));}else{created+=1;}
        }
    }
    Ok(json!({"created":created,"updated":updated,"skipped":skipped,"errors":errors}))
}
pub fn apply(db:&mut Connection,actor:&security::Actor,items:Vec<ImportRow>,update:bool,request:&str)->Result<Value>{
    actor.require("products.edit")?;actor.require("costs.view")?;
    uuid::Uuid::parse_str(request).map_err(err)?;
    let body=serde_json::to_string(&json!({"import":items,"update":update})).map_err(err)?;
    let tx=db.transaction().map_err(err)?;
    if let Ok((owner,old,response))=tx.query_row("SELECT user_id,body,response FROM requests WHERE id=?",[request],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?))){
        if owner!=actor.id||old!=body{return Err("Solicitud reutilizada con otros datos".into());}return serde_json::from_str(&response).map_err(err);
    }
    let report=validate(&tx,&items,update)?;
    if !report["errors"].as_array().unwrap().is_empty(){return Err("La importación tiene errores. Vuelve a revisar el archivo; no se guardó ningún cambio.".into());}
    for p in &items{
        let id=tx.query_row("SELECT id FROM products WHERE code=?",[p.code.trim()],|r|r.get::<_,i64>(0)).ok();
        if let Some(id)=id{if update{tx.execute("UPDATE products SET name=?,category=?,price=?,cost=?,cost_known=? WHERE id=?",params![p.name.trim(),p.category.trim(),p.price,p.cost.unwrap_or(0),p.cost.is_some(),id]).map_err(err)?;}}
        else{tx.execute("INSERT INTO products(code,name,category,icon,price,cost,cost_known,unit,created) VALUES(?,?,?,'auto',?,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))",params![p.code.trim(),p.name.trim(),p.category.trim(),p.price,p.cost.unwrap_or(0),p.cost.is_some(),p.unit]).map_err(err)?;}
    }
    security::audit(&tx,actor.id,json!({"type":"catalog.imported","message":"Se importó un archivo de productos. Las existencias se conservaron.","summary":report}))?;
    tx.execute("INSERT INTO requests(id,user_id,body,response) VALUES(?,?,?,?)",params![request,actor.id,body,report.to_string()]).map_err(err)?;
    tx.commit().map_err(err)?;Ok(report)
}
fn money(s:&str)->Result<i64>{
    let parts:Vec<_>=s.trim().split('.').collect();
    if parts.is_empty()||parts.len()>2||parts[0].is_empty()||!parts.iter().all(|p|p.bytes().all(|c|c.is_ascii_digit()))||parts.get(1).is_some_and(|p|p.len()>2){return Err("Usa importes positivos con punto decimal y sin separadores de miles".into());}
    let whole=parts[0].parse::<i64>().map_err(err)?;
    let cents=parts.get(1).map(|p|format!("{p:0<2}").parse::<i64>()).transpose().map_err(err)?.unwrap_or(0);
    whole.checked_mul(100).and_then(|n|n.checked_add(cents)).ok_or("Importe demasiado grande".into())
}
pub fn parse(bytes:Vec<u8>,format:&str)->Result<Vec<ImportRow>>{
    if bytes.len()>10*1024*1024{return Err("El archivo supera 10 MB".into());}
    let table:Vec<Vec<String>>=if format=="xlsx"{
        let mut archive=zip::ZipArchive::new(Cursor::new(&bytes)).map_err(err)?;
        if archive.len()>5000{return Err("El libro contiene demasiados archivos internos".into());}
        let mut expanded=0u64;
        for i in 0..archive.len(){expanded=expanded.checked_add(archive.by_index(i).map_err(err)?.size()).ok_or("Libro demasiado grande")?;if expanded>64*1024*1024{return Err("El contenido del libro supera 64 MB; divídelo en archivos más pequeños".into());}}
        drop(archive);
        let mut book:Xlsx<_>=Xlsx::new(Cursor::new(bytes)).map_err(err)?;
        let range=book.worksheet_range_at(0).ok_or("El libro no tiene hojas")?.map_err(err)?;
        if range.height()>10001||range.width()>50{return Err("Máximo 10,000 filas y 50 columnas".into());}
        range.rows().map(|r|r.iter().map(ToString::to_string).collect()).collect()
    }else{
        let delimiter=if format=="tsv"{b'\t'}else{b','};
        let mut reader=csv::ReaderBuilder::new().has_headers(false).delimiter(delimiter).from_reader(bytes.as_slice());
        reader.records().take(10002).map(|r|r.map(|r|r.iter().map(str::to_owned).collect()).map_err(err)).collect::<Result<_>>()?
    };
    if table.len()<2||table.len()>10001{return Err("El archivo debe incluir encabezados y entre 1 y 10,000 productos".into());}
    let headers:Vec<_>=table[0].iter().map(|s|s.trim().trim_start_matches('\u{feff}').to_lowercase()).collect();
    let columns:[usize;6]=["codigo","nombre","categoria","unidad","precio","costo"].map(|name|headers.iter().position(|h|h==name).unwrap_or(usize::MAX));
    if columns.contains(&usize::MAX){return Err("Usa la plantilla: codigo,nombre,categoria,unidad,precio,costo. Código debe ser texto en Excel para conservar ceros iniciales.".into());}
    table[1..].iter().enumerate().map(|(i,row)|{
        let fields:Vec<_>=columns.iter().map(|&c|row.get(c).map(|s|s.trim()).unwrap_or("")).collect();
        let price=money(fields[4]).map_err(|e|format!("Fila {}: {}",i+2,e))?;
        let cost=if fields[5].is_empty(){None}else{Some(money(fields[5]).map_err(|e|format!("Fila {}: {}",i+2,e))?)};
        Ok(ImportRow{code:fields[0].into(),name:fields[1].into(),category:fields[2].into(),unit:fields[3].into(),price,cost})
    }).collect()
}

pub fn export(db:&Connection)->Result<Vec<u8>>{
    let mut book=rust_xlsxwriter::Workbook::new();let sheet=book.add_worksheet();
    for (col,name) in ["codigo","nombre","categoria","unidad","precio","costo"].iter().enumerate(){sheet.write_string(0,col as u16,*name).map_err(err)?;}
    let items=crate::rows(db,"SELECT code,name,category,unit,price,CASE WHEN cost_known=1 THEN cost ELSE NULL END AS cost FROM products ORDER BY name")?;
    if items.len()>10000{return Err("El catálogo supera 10,000 productos; requiere exportación por lotes".into());}
    for (i,item) in items.iter().enumerate(){let row=(i+1) as u32;
        for (col,key) in ["code","name","category","unit"].iter().enumerate(){sheet.write_string(row,col as u16,item[*key].as_str().unwrap_or("")).map_err(err)?;}
        sheet.write_string(row,4,format!("{}.{:02}",item["price"].as_i64().unwrap_or(0)/100,item["price"].as_i64().unwrap_or(0)%100)).map_err(err)?;
        if let Some(cost)=item["cost"].as_i64(){sheet.write_string(row,5,format!("{}.{:02}",cost/100,cost%100)).map_err(err)?;}
    }
    sheet.set_column_width(0,22).map_err(err)?;sheet.set_column_width(1,45).map_err(err)?;
    book.save_to_buffer().map_err(err)
}
pub fn export_service(store:&Store,token:String)->Result<Value>{let db=store.db.lock().map_err(err)?;let actor=security::authorize(store,&db,&token,"products.edit")?;actor.require("costs.view")?;Ok(json!(export(&db)?))}
#[tauri::command]
pub fn catalog_preview(store:State<Store>,session_token:String,bytes:Vec<u8>,format:String,update:bool)->Result<Value> { catalog_preview_service(&store, session_token, bytes, format, update) }
pub(crate) fn catalog_preview_service(store:&Store, session_token:String,bytes:Vec<u8>,format:String,update:bool)->Result<Value> {
    let db=store.db.lock().map_err(err)?;let actor=security::authorize(&store,&db,&session_token,"products.edit")?;actor.require("costs.view")?;
    let items=parse(bytes,&format)?;let report=validate(&db,&items,update)?;Ok(json!({"items":items,"report":report}))
}
#[tauri::command]
pub fn catalog_apply(store:State<Store>,session_token:String,items:Vec<ImportRow>,update:bool,request_id:String)->Result<Value> { catalog_apply_service(&store, session_token, items, update, request_id) }
pub(crate) fn catalog_apply_service(store:&Store, session_token:String,items:Vec<ImportRow>,update:bool,request_id:String)->Result<Value> {
    let mut db=store.db.lock().map_err(err)?;let actor=security::authorize(&store,&db,&session_token,"products.edit")?;apply(&mut db,&actor,items,update,&request_id)
}
