//! Facturama API Web 4.0, sandbox only. Credentials never enter SQLite or audit.
use crate::{err,rows,security,Result,Store};
use rusqlite::{params,Connection};
use serde::{Deserialize,Serialize};
use serde_json::{json,Value};
use std::{collections::HashMap,sync::{Mutex,OnceLock},time::Duration};
const BASE:&str="https://apisandbox.facturama.mx";
static CREDENTIALS:OnceLock<Mutex<HashMap<String,(String,String)>>>=OnceLock::new();
fn credentials()->&'static Mutex<HashMap<String,(String,String)>>{CREDENTIALS.get_or_init(||Mutex::new(HashMap::new()))}
pub fn forget(token:&str){if let Ok(mut values)=credentials().lock(){values.remove(token);}}
#[derive(Deserialize,Serialize)]
pub struct Receiver{pub rfc:String,pub name:String,pub regime:String,pub zip:String,pub usage:String}
#[derive(Deserialize,Serialize)]
pub struct TaxLine{pub product_code:String,pub unit_code:String,pub tax:String}
#[derive(Deserialize)]
pub struct Draft{pub sale:String,pub receiver:Receiver,pub expedition:String,pub payment_form:String,pub items:Vec<TaxLine>}
fn digits(s:&str,n:usize)->bool{s.len()==n&&s.bytes().all(|b|b.is_ascii_digit())}
pub fn payload(receipt:&Value,draft:&Draft,folio:&str,date:&str)->Result<Value>{
    let r=&draft.receiver;
    if !(12..=13).contains(&r.rfc.chars().count())||!r.rfc.chars().all(|c|c.is_ascii_uppercase()||c.is_ascii_digit()||c=='&'||c=='Ñ')||r.name.trim().is_empty()||r.name.len()>254||!digits(&r.regime,3)||!digits(&r.zip,5)||!digits(&draft.expedition,5)||r.usage.len()!=3{return Err("Revisa RFC, razón social, régimen, uso CFDI y códigos postales".into());}
    if r.rfc=="XAXX010101000"{return Err("La factura global requiere datos de periodicidad; usa un receptor fiscal individual en este flujo de pruebas".into());}
    if receipt["tender"]["credit"].as_i64().unwrap_or(0)>0||receipt["payment"]=="credit"{return Err("Esta prueba admite ventas pagadas. El fiado requiere PPD y complemento de pago.".into());}
    let allowed=match receipt["payment"].as_str().unwrap_or(""){"cash"=>vec!["01"],"card"=>vec!["04","28"],"transfer"=>vec!["03"],"check"=>vec!["02"],_=>vec![]};
    if !allowed.contains(&draft.payment_form.as_str()){return Err("La forma de pago debe coincidir con el ticket. Usa una venta con un solo medio de pago.".into());}
    let items=receipt["items"].as_array().ok_or("Ticket sin conceptos")?;
    if items.len()!=draft.items.len()||items.is_empty(){return Err("Configura los datos fiscales de todos los conceptos".into());}
    let mut output=vec![];
    for (item,tax) in items.iter().zip(&draft.items){
        if !digits(&tax.product_code,8)||tax.unit_code.is_empty()||tax.unit_code.len()>3||!tax.unit_code.bytes().all(|b|b.is_ascii_alphanumeric()){return Err("Revisa las claves SAT de producto y unidad".into());}
        let cents=item["subtotal"].as_i64().filter(|v|*v>0).ok_or("Importe inválido")?;
        let quantity=item["quantity"].as_i64().filter(|v|*v>0).ok_or("Cantidad inválida")? as f64/1000.;
        let rate=match tax.tax.as_str(){"iva16"=>Some(16i64),"iva8"=>Some(8),"iva0"=>Some(0),"none"=>None,_=>return Err("Impuesto no soportado en esta prueba".into())};
        // Derive tax from the tax-inclusive ticket amount, in integer cents.
        let base=rate.map(|r|(cents*100+(100+r)/2)/(100+r)).unwrap_or(cents);
        let mut line=json!({"ProductCode":tax.product_code,"IdentificationNumber":item["id"].to_string(),"Description":item["name"],"UnitCode":tax.unit_code,"Unit":item["unit"],"UnitPrice":((base as f64/100./quantity)*1_000_000.).round()/1_000_000.,"Quantity":quantity,"Subtotal":base as f64/100.,"TaxObject":if rate.is_some(){"02"}else{"01"},"Total":cents as f64/100.});
        if let Some(rate)=rate{line["Taxes"]=json!([{"Total":(cents-base) as f64/100.,"Name":"IVA","Base":base as f64/100.,"Rate":rate as f64/100.,"IsRetention":false}]);}
        output.push(line);
    }
    Ok(json!({"NameId":"1","Currency":"MXN","Folio":folio,"Serie":"GRIDTEST","CfdiType":"I","PaymentForm":draft.payment_form,"PaymentMethod":"PUE","OrderNumber":draft.sale,"ExpeditionPlace":draft.expedition,"Date":date,"Exportation":"01","Receiver":{"Rfc":r.rfc,"Name":r.name,"FiscalRegime":r.regime,"TaxZipCode":r.zip,"CfdiUse":r.usage},"Items":output}))
}
pub fn prepare(db:&mut Connection,actor:&security::Actor,draft:Draft)->Result<Value>{
    actor.require("settings.manage")?;
    let tx=db.transaction().map_err(err)?;
    let refunded:i64=tx.query_row("SELECT count(*) FROM refunds WHERE sale=?",[&draft.sale],|r|r.get(0)).map_err(err)?;
    if refunded>0{return Err("No se puede facturar una venta devuelta".into());}
    let raw:String=tx.query_row("SELECT receipt FROM sales WHERE id=?",[&draft.sale],|r|r.get(0)).map_err(err)?;
    let receipt:Value=serde_json::from_str(&raw).map_err(err)?;
    let id=uuid::Uuid::new_v4().to_string();
    let date:String=tx.query_row("SELECT strftime('%Y-%m-%dT%H:%M:%S','now','localtime')",[],|r|r.get(0)).map_err(err)?;
    let body=payload(&receipt,&draft,&id,&date)?;
    let existing=tx.query_row("SELECT id,state FROM fiscal_documents WHERE sale=?",[&draft.sale],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?))).ok();
    if existing.as_ref().is_some_and(|(_,s)|s!="draft"){return Err("Esta venta ya tiene una solicitud. Consulta su estado antes de emitir otra.".into());}
    if let Some((old,_))=existing{tx.execute("DELETE FROM fiscal_documents WHERE id=?",[old]).map_err(err)?;}
    tx.execute("INSERT INTO fiscal_documents(id,sale,payload) VALUES(?,?,?)",params![id,draft.sale,body.to_string()]).map_err(err)?;
    security::audit(&tx,actor.id,json!({"type":"fiscal.draft","message":"Se preparó una factura de prueba; todavía no se ha enviado","sale":draft.sale}))?;
    tx.commit().map_err(err)?;Ok(json!({"id":id,"payload":body}))
}
fn request(method:reqwest::Method,path:&str,body:Option<&Value>,auth:&(String,String))->Result<Value>{
    let client=reqwest::blocking::Client::builder().redirect(reqwest::redirect::Policy::none()).connect_timeout(Duration::from_secs(8)).timeout(Duration::from_secs(35)).build().map_err(err)?;
    let mut request=client.request(method,format!("{BASE}{path}")).basic_auth(&auth.0,Some(&auth.1));if let Some(body)=body{request=request.json(body);}
    let response=request.send().map_err(|_|"No hubo confirmación de Facturama. Consulta el estado antes de volver a emitir.".to_string())?;
    let status=response.status();let value:Value=response.json().map_err(|_|"Facturama respondió sin un documento válido")?;
    if !status.is_success(){return Err(format!("Facturama ({status}): {}",value.get("Message").and_then(Value::as_str).unwrap_or("Revisa los datos o las credenciales en el portal de pruebas")));}Ok(value)
}
fn provider_id(value:&str)->Result<&str>{if value.is_empty()||value.len()>100||!value.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'-'||b==b'_'){Err("Identificador de Facturama inválido".into())}else{Ok(value)}}
pub fn verify_result(value:&Value,body:&Value)->Result<(String,String)>{
    let id=provider_id(value["Id"].as_str().ok_or("Facturama no devolvió identificador")?)?.to_owned();
    let uuid=value["Complement"]["TaxStamp"]["Uuid"].as_str().ok_or("No hay timbre confirmado")?;
    uuid::Uuid::parse_str(uuid).map_err(|_|"Timbre inválido")?;
    let total:f64=body["Items"].as_array().ok_or("Conceptos inválidos")?.iter().map(|i|i["Total"].as_f64().unwrap_or(0.)).sum();
    if value["Folio"]!=body["Folio"]||value["Receiver"]["Rfc"]!=body["Receiver"]["Rfc"]||(value["Total"].as_f64().unwrap_or(-1.)-total).abs()>0.009{return Err("La respuesta fiscal no coincide con la venta; requiere revisión".into());}
    Ok((id,uuid.to_owned()))
}
pub fn service(store:&Store,session_token:String,action:String,input:Value)->Result<Value>{
    let actor={let db=store.db.lock().map_err(err)?;security::authorize(store,&db,&session_token,"settings.manage")?};
    if action=="credentials"{
        let user=input["username"].as_str().unwrap_or("");let password=input["password"].as_str().unwrap_or("");
        if user.is_empty()||user.len()>200||password.is_empty()||password.len()>200{return Err("Introduce las credenciales API del entorno de pruebas".into());}
        credentials().lock().map_err(err)?.insert(session_token,(user.into(),password.into()));return Ok(json!({"ready":true}));
    }
    if action=="list"{let db=store.db.lock().map_err(err)?;return Ok(json!({"documents":rows(&db,"SELECT id,sale,state,provider_id,uuid,created FROM fiscal_documents ORDER BY created DESC LIMIT 100")?,"sales":rows(&db,"SELECT id,total,created FROM sales WHERE NOT EXISTS(SELECT 1 FROM refunds WHERE sale=sales.id) ORDER BY created DESC LIMIT 100")?,"ready":credentials().lock().map_err(err)?.contains_key(&session_token)}));}
    if action=="sale"{let db=store.db.lock().map_err(err)?;let raw:String=db.query_row("SELECT receipt FROM sales WHERE id=?",[input["sale"].as_str().ok_or("Selecciona un ticket")?],|r|r.get(0)).map_err(err)?;let value:Value=serde_json::from_str(&raw).map_err(err)?;return Ok(json!({"items":value["items"],"payment":value["payment"],"total":value["total"]}));}
    if action=="draft"{let mut db=store.db.lock().map_err(err)?;return prepare(&mut db,&actor,serde_json::from_value(input).map_err(err)?);}
    let id=input["id"].as_str().ok_or("Selecciona una factura")?;
    let auth=credentials().lock().map_err(err)?.get(&session_token).cloned().ok_or("Conecta tu cuenta de Facturama de pruebas")?;
    let (state,raw,remote):(String,String,Option<String>)={let db=store.db.lock().map_err(err)?;db.query_row("SELECT state,payload,provider_id FROM fiscal_documents WHERE id=?",[id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).map_err(err)?};
    let body:Value=serde_json::from_str(&raw).map_err(err)?;
    if action=="download"{
        let format=input["format"].as_str().unwrap_or("");if !["xml","pdf"].contains(&format){return Err("Elige XML o PDF".into());}
        let remote=remote.ok_or("No hay timbre confirmado")?;provider_id(&remote)?;
        return request(reqwest::Method::GET,&format!("/cfdi/{format}/issued/{remote}"),None,&auth);
    }
    let result=if action=="stamp"{
        let db=store.db.lock().map_err(err)?;
        if db.execute("UPDATE fiscal_documents SET state='sending' WHERE id=? AND state='draft'",[id]).map_err(err)?!=1{return Err("La factura ya fue enviada. Usa Consultar para recuperar su resultado.".into());}
        drop(db);
        request(reqwest::Method::POST,"/3/cfdis",Some(&body),&auth)
    }else if action=="reconcile"{
        let remote=remote.or_else(||input["provider_id"].as_str().filter(|s|!s.is_empty()).map(str::to_owned));
        if let Some(remote)=remote{provider_id(&remote)?;request(reqwest::Method::GET,&format!("/cfdi/{remote}?type=issued"),None,&auth)}
        else{let list=request(reqwest::Method::GET,&format!("/cfdi?type=issued&page=0&folio={id}"),None,&auth)?;let matches=list.as_array().ok_or("No se pudo consultar el folio; búscalo en Facturama")?;let found=matches.iter().find(|v|v["Folio"]==body["Folio"]).ok_or("Aún no se encuentra el folio en Facturama. Revisa el portal antes de emitir otra factura.")?;let remote=provider_id(found["Id"].as_str().ok_or("Respuesta incompleta")?)?;request(reqwest::Method::GET,&format!("/cfdi/{remote}?type=issued"),None,&auth)}
    }else if action=="cancel"{
        let remote=remote.ok_or("No hay factura timbrada")?;provider_id(&remote)?;
        let motive=input["motive"].as_str().unwrap_or("");if !["02","03"].contains(&motive){return Err("Elige un motivo de cancelación sin sustitución (02 o 03)".into());}
        let value=request(reqwest::Method::DELETE,&format!("/cfdi/{remote}?type=issued&motive={motive}"),None,&auth)?;
        let next=match value["Status"].as_str(){Some("canceled")=>"canceled",Some("pending")=>"cancel_pending",_=>"stamped"};
        let db=store.db.lock().map_err(err)?;db.execute("UPDATE fiscal_documents SET state=?,response=? WHERE id=?",params![next,value.to_string(),id]).map_err(err)?;
        security::audit(&db,actor.id,json!({"type":"fiscal.cancel","message":"Se consultó la cancelación de una factura de prueba","id":id,"state":next}))?;return Ok(value);
    }else{return Err(format!("Acción fiscal no disponible ({state})"));};
    let db=store.db.lock().map_err(err)?;
    match result.and_then(|value|{let (remote,uuid)=verify_result(&value,&body)?;Ok((value,remote,uuid))}){
        Ok((value,remote,uuid))=>{let state=if value["Status"]=="canceled"{"canceled"}else{"stamped"};db.execute("UPDATE fiscal_documents SET state=?,provider_id=?,uuid=?,response=? WHERE id=?",params![state,remote,uuid,value.to_string(),id]).map_err(err)?;security::audit(&db,actor.id,json!({"type":"fiscal.confirmed","message":"Facturama confirmó una factura de prueba, sin validez fiscal","id":id,"uuid":uuid}))?;Ok(value)},
        Err(error)=>{let next=if error.starts_with("Facturama (401 ")||error.starts_with("Facturama (403 "){"draft"}else{"review"};db.execute("UPDATE fiscal_documents SET state=?,response=? WHERE id=? AND state='sending'",params![next,json!({"error":error}).to_string(),id]).map_err(err)?;Err(error)}
    }
}
