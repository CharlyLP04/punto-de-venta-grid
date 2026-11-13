// Network and local clients run the same application services.
use crate::{err,Result,Store};
use serde_json::Value;
fn arg<T:serde::de::DeserializeOwned>(args:&Value,key:&str)->Result<T>{serde_json::from_value(args[key].clone()).map_err(|_|format!("Parámetro inválido: {}",key))}
pub fn dispatch(store:&Store,command:&str,mut args:Value)->Result<Value>{
    let _operation=crate::lifecycle::enter()?;
    if !args.is_object(){return Err("Los parámetros deben ser un objeto".into());}
    // Only public ticket numbers are accepted. Internal tickets are isolated per register.
    for key in ["ticket","action","operation"] {
        let value=if key=="ticket" {&mut args["ticket"]}else{if !args[key].is_object(){continue;} &mut args[key]["ticket"]};
        if !value.is_null(){let ticket=value.as_i64().ok_or("Ticket inválido")?;if !(1..=5).contains(&ticket){return Err("Ticket inválido".into());}*value=serde_json::json!((crate::network::register()-1)*5+ticket);}
    }
    match command{
"catalog_export"=>crate::catalog_import::export_service(store,arg(&args,"sessionToken")?),
"fiscal"=>crate::fiscal::service(store,arg(&args,"sessionToken")?,arg(&args,"action")?,arg(&args,"input")?),
"snapshot"=>serde_json::to_value(crate::snapshot_service(store, arg(&args,"sessionToken")?)?).map_err(err),
"mutate"=>serde_json::to_value(crate::mutate_service(store, arg(&args,"sessionToken")?,arg(&args,"requestId")?,arg(&args,"action")?)?).map_err(err),
"auth_status"=>serde_json::to_value(crate::security::auth_status_service(store)?).map_err(err),
"login"=>serde_json::to_value(crate::security::login_service(store, arg(&args,"username")?,arg(&args,"password")?)?).map_err(err),
"logout"=>serde_json::to_value(crate::security::logout_service(store, arg(&args,"sessionToken")?)?).map_err(err),
"users_list"=>serde_json::to_value(crate::security::users_list_service(store, arg(&args,"sessionToken")?)?).map_err(err),
"user_save"=>serde_json::to_value(crate::security::user_save_service(store, arg(&args,"sessionToken")?,arg(&args,"input")?)?).map_err(err),
"approve_operation"=>serde_json::to_value(crate::security::approve_operation_service(store, arg(&args,"sessionToken")?,arg(&args,"requestId")?,arg(&args,"operation")?,arg(&args,"approval")?)?).map_err(err),
"checkout"=>serde_json::to_value(crate::business::checkout_service(store, arg(&args,"sessionToken")?,arg(&args,"ticket")?,arg(&args,"requestId")?,arg(&args,"received")?,arg(&args,"customer")?,arg(&args,"tender")?)?).map_err(err),
"operate"=>serde_json::to_value(crate::business::operate_service(store, arg(&args,"sessionToken")?,arg(&args,"requestId")?,arg(&args,"operation")?,arg(&args,"approvalToken")?)?).map_err(err),
"management"=>serde_json::to_value(crate::business::management_service(store, arg(&args,"sessionToken")?,arg(&args,"section")?)?).map_err(err),
"advanced_save"=>serde_json::to_value(crate::advanced::advanced_save_service(store, arg(&args,"sessionToken")?,arg(&args,"edit")?)?).map_err(err),
"advanced_list"=>serde_json::to_value(crate::advanced::advanced_list_service(store, arg(&args,"sessionToken")?,arg(&args,"section")?)?).map_err(err),
"filtered_report"=>serde_json::to_value(crate::advanced::filtered_report_service(store, arg(&args,"sessionToken")?,arg(&args,"filter")?)?).map_err(err),
"sale_history"=>serde_json::to_value(crate::history::sale_history_service(store, arg(&args,"sessionToken")?,arg(&args,"filter")?)?).map_err(err),
"procurement_list"=>serde_json::to_value(crate::procurement::procurement_list_service(store, arg(&args,"sessionToken")?)?).map_err(err),
"procurement_save"=>serde_json::to_value(crate::procurement::procurement_save_service(store, arg(&args,"sessionToken")?,arg(&args,"requestId")?,arg(&args,"action")?)?).map_err(err),
"catalog_preview"=>serde_json::to_value(crate::catalog_import::catalog_preview_service(store, arg(&args,"sessionToken")?,arg(&args,"bytes")?,arg(&args,"format")?,arg(&args,"update")?)?).map_err(err),
"catalog_apply"=>serde_json::to_value(crate::catalog_import::catalog_apply_service(store, arg(&args,"sessionToken")?,arg(&args,"items")?,arg(&args,"update")?,arg(&args,"requestId")?)?).map_err(err),
_=>Err("Operación no disponible por esta conexión".into())
}
}
