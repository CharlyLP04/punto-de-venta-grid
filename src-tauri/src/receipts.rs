use crate::{err,setting,Result,Store,security};
use serde_json::{json,Value};
use std::{io::Write,time::Duration};
use tauri::State;

fn send(port:String,baud:u32,text:String,drawer:bool)->Result<()> {
    // All physical writes share one queue, including repayment receipts.
    static PRINTER: std::sync::Mutex<()> = std::sync::Mutex::new(());
    let _printer=PRINTER.lock().map_err(err)?;
    let mut bytes=vec![0x1b,0x40];
    bytes.extend(text.chars().map(|c|match c{'á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ñ'=>'n','Á'=>'A','É'=>'E','Í'=>'I','Ó'=>'O','Ú'=>'U','Ñ'=>'N','\n'=>'\n',c if c.is_ascii()&&!c.is_control()=>c,_=>'?'}).map(|c|c as u8));
    bytes.extend([10,10,10,0x1d,0x56,0]);
    if drawer{bytes.extend([0x1b,0x70,0,25,250]);}
    let mut device=serialport::new(port,baud).timeout(Duration::from_secs(3)).open().map_err(err)?;
    device.write_all(&bytes).map_err(err)?;device.flush().map_err(err)
}
#[tauri::command]
pub async fn print_sale(store:State<'_,Store>,session_token:String,id:String,reprint:bool)->Result<()> {
    let (port,baud,text,drawer,actor_id)={
        let db=store.db.lock().map_err(err)?;
        let actor=security::authorize(&store,&db,&session_token,"receipt.print")?;
        let (owner,raw,status):(Option<i64>,String,String)=db.query_row("SELECT user_id,receipt,print_status FROM sales WHERE id=?",[&id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).map_err(err)?;
        if owner!=Some(actor.id)&&!actor.can("reports.view"){return Err("Venta de otro cajero".into());}
        if status=="sending"||status=="uncertain"{return Err("El envío anterior es incierto. Revisa la impresora antes de marcarlo para reimpresión.".into());}
        if status=="sent"&&!reprint{return Err("El ticket ya fue enviado; solicita una copia".into());}
        let receipt:Value=serde_json::from_str(&raw).map_err(err)?;
        let port=setting(&db,"printer","");if port.is_empty(){return Err("Configura la impresora".into());}
        let mut text=format!("{}\n{}\n{}\n{}\nFolio: {}\nCajero: {}\n--------------------------------\n",receipt["store"].as_str().unwrap_or("GRID POS"),receipt["address"].as_str().unwrap_or(""),receipt["phone"].as_str().unwrap_or(""),if reprint{"COPIA"}else{"VENTA"},id,receipt["cashier"].as_str().unwrap_or("Historico"));
        for item in receipt["items"].as_array().ok_or("Recibo inválido")? {text.push_str(&format!("{}\n{:.3} {}  ${:.2}\n",item["name"].as_str().unwrap_or(""),item["quantity"].as_i64().unwrap_or(0) as f64/1000.,item["unit"].as_str().unwrap_or(""),item["subtotal"].as_i64().unwrap_or(0) as f64/100.));}
        text.push_str(&format!("--------------------------------\nTOTAL ${:.2}\n{}\nCambio ${:.2}\n{}\n",receipt["total"].as_i64().unwrap_or(0) as f64/100.,receipt["payment"].as_str().unwrap_or(""),receipt["change"].as_i64().unwrap_or(0) as f64/100.,receipt["footer"].as_str().unwrap_or("Gracias por tu compra")));
        for key in ["cash","card","credit","transfer","voucher","check","usd"]{if let Some(amount)=receipt["tender"][key].as_i64(){if amount>0{text.push_str(&format!("{}: ${:.2}\n",key,amount as f64/100.));}}}
        if receipt["foreign"]["units"].as_i64().unwrap_or(0)>0{text.push_str(&format!("USD recibidos: {:.2}\nTipo de cambio MXN: {:.2}\n",receipt["foreign"]["units"].as_i64().unwrap_or(0) as f64/100.,receipt["foreign"]["rate"].as_i64().unwrap_or(0) as f64/100.));}
        let refunded:i64=db.query_row("SELECT count(*) FROM refunds WHERE sale=?",[&id],|r|r.get(0)).map_err(err)?;
        if refunded>0{text.push_str("VENTA DEVUELTA\n");}
        let drawer=!reprint&&refunded==0&&(receipt["tender"]["cash"].as_i64().unwrap_or(0)>0||receipt["payment"]=="cash"||receipt["tender"]["usd"].as_i64().unwrap_or(0)>0);
        db.execute("UPDATE sales SET print_status='sending' WHERE id=?",[&id]).map_err(err)?;
        security::audit(&db,actor.id,json!({"type":"receipt.sending","sale":id,"copy":reprint,"drawer":drawer}))?;
        (port,setting(&db,"baud","9600").parse::<u32>().unwrap_or(9600),text,drawer,actor.id)
    };
    let outcome=tauri::async_runtime::spawn_blocking(move||send(port,baud,text,drawer)).await.map_err(err)?;
    let db=store.db.lock().map_err(err)?;
    match outcome {
        Ok(())=>{db.execute("UPDATE sales SET print_status='sent' WHERE id=?",[&id]).map_err(err)?;security::audit(&db,actor_id,json!({"type":"receipt.sent","sale":id}))?;Ok(())},
        Err(error)=>{db.execute("UPDATE sales SET print_status='uncertain' WHERE id=?",[&id]).map_err(err)?;Err(format!("Envío incierto: {}. Revisa el papel y solicita una copia si hace falta.",error))}
    }
}
#[tauri::command]
pub async fn print_repayment(store:State<'_,Store>,session_token:String,id:String)->Result<()> {
    let (port,baud,text)={
        let db=store.db.lock().map_err(err)?;let actor=security::authorize(&store,&db,&session_token,"receipt.print")?;actor.require("credit.repay")?;
        let (name,amount,previous,balance,created,owner):(String,i64,i64,i64,String,i64)=db.query_row("SELECT c.name,r.amount,r.previous_balance,r.balance,r.created,r.user_id FROM repayment_receipts r JOIN customers c ON c.id=r.customer WHERE r.id=?",[&id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?))).map_err(err)?;
        if owner!=actor.id&&!actor.can("reports.view"){return Err("Abono de otro usuario".into());}
        let port=setting(&db,"printer","");if port.is_empty(){return Err("Configura la impresora".into());}
        security::audit(&db,actor.id,json!({"type":"repayment.print","id":id}))?;
        (port,setting(&db,"baud","9600").parse::<u32>().unwrap_or(9600),format!("{}\nCOMPROBANTE DE ABONO\n{}\nFolio: {}\nCliente: {}\nSaldo anterior: ${:.2}\nAbono: ${:.2}\nSaldo restante: ${:.2}\n{}\n",setting(&db,"store_name","GRID POS"),created,id,name,previous as f64/100.,amount as f64/100.,balance as f64/100.,setting(&db,"receipt_footer","Gracias")))
    };
    tauri::async_runtime::spawn_blocking(move||send(port,baud,text,false)).await.map_err(err)?
}
#[tauri::command]
pub fn resolve_print(store:State<Store>,session_token:String,id:String)->Result<()> {
    let db=store.db.lock().map_err(err)?;let actor=security::authorize(&store,&db,&session_token,"receipt.print")?;
    let owner:Option<i64>=db.query_row("SELECT user_id FROM sales WHERE id=?",[&id],|r|r.get(0)).map_err(err)?;
    if owner!=Some(actor.id)&&!actor.can("reports.view"){return Err("Venta de otro usuario".into());}
    db.execute("UPDATE sales SET print_status='sent' WHERE id=? AND print_status IN ('sending','uncertain')",[&id]).map_err(err)?;
    security::audit(&db,actor.id,json!({"type":"receipt.uncertainty_acknowledged","sale":id}))
}
