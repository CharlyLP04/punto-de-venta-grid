use super::*;

#[test]
fn import_is_atomic_idempotent_and_preserves_inventory(){
    let mut db=database();let actor=cashier(&db);
    let csv=b"codigo,nombre,categoria,unidad,precio,costo\n0000123,Prueba,Pruebas,pieza,12.34,\n0000124,Segunda,Pruebas,kg,20.00,0.00\n";
    let items=catalog_import::parse(csv.to_vec(),"csv").unwrap();assert_eq!(items[0].code,"0000123");assert_eq!(items[0].price,1234);
    let mut invalid=items.clone();invalid[1].code=invalid[0].code.clone();
    assert!(catalog_import::apply(&mut db,&actor,invalid,false,&Uuid::new_v4().to_string()).is_err());
    assert_eq!(db.query_row("SELECT count(*) FROM products WHERE code='0000123'",[],|r|r.get::<_,i64>(0)).unwrap(),0);
    let request=Uuid::new_v4().to_string();let first=catalog_import::apply(&mut db,&actor,items.clone(),false,&request).unwrap();
    assert_eq!(first["created"],2);assert_eq!(catalog_import::apply(&mut db,&actor,items.clone(),false,&request).unwrap(),first);
    db.execute("UPDATE products SET stock=7000 WHERE code='0000123'",[]).unwrap();
    let mut changed=items;changed[0].price=5000;
    catalog_import::apply(&mut db,&actor,changed,true,&Uuid::new_v4().to_string()).unwrap();
    assert_eq!(db.query_row("SELECT stock FROM products WHERE code='0000123'",[],|r|r.get::<_,i64>(0)).unwrap(),7000);
    assert!(catalog_import::parse(b"codigo,nombre,categoria,unidad,precio,costo\nX,X,X,pieza,1.999,\n".to_vec(),"csv").is_err());
}

#[test]
fn excel_export_can_be_imported_without_losing_codes_or_costs(){
    let db=database();let bytes=catalog_import::export(&db).unwrap();let rows=catalog_import::parse(bytes,"xlsx").unwrap();
    assert_eq!(rows.len(),1309);assert_eq!(rows.iter().filter(|r|r.cost.is_none()).count(),999);
    for row in rows{let price:i64=db.query_row("SELECT price FROM products WHERE code=?",[row.code],|r|r.get(0)).unwrap();assert_eq!(row.price,price);}
}

#[test]
fn multiple_registers_keep_tickets_shifts_and_stock_consistent(){
    let mut db=database();let actor=cashier(&db);
    db.execute("INSERT INTO registers(id,name) VALUES(2,'Caja 2')",[]).unwrap();
    db.execute("INSERT INTO shifts(opening,user_id,register_id) VALUES(0,1,2)",[]).unwrap();
    db.execute("UPDATE products SET stock=1000,price=1000 WHERE id=1",[]).unwrap();
    db.execute("INSERT INTO cart(ticket,product,quantity) VALUES(1,1,1000),(6,1,1000)",[]).unwrap();
    assert!(business::quote(&db,6).is_err());
    let sale1=Uuid::new_v4().to_string();business::checkout_transaction(&mut db,&actor,1,sale1.clone(),1000,None,None).unwrap();
    network::at_register(2,||{
        assert_eq!(active(&db).unwrap(),2);
        assert!(business::checkout_transaction(&mut db,&actor,6,Uuid::new_v4().to_string(),1000,None,None).is_err());
        assert!(business::checkout_transaction(&mut db,&actor,6,sale1,1000,None,None).is_err());
        retail::add_common(&db,7,"Servicio caja 2",1000,500,None).unwrap();
        business::checkout_transaction(&mut db,&actor,7,Uuid::new_v4().to_string(),500,None,None).unwrap();
    });
    assert_eq!(network::register(),1);assert_eq!(cash(&db,1).unwrap(),1000);assert_eq!(cash(&db,2).unwrap(),500);
    assert_eq!(db.query_row("SELECT count(*) FROM cart WHERE ticket=6",[],|r|r.get::<_,i64>(0)).unwrap(),1);
    // A restart must not recreate the old global unique shift index.
    initialize(&mut db).unwrap();assert_eq!(db.query_row("SELECT count(*) FROM shifts WHERE closed IS NULL",[],|r|r.get::<_,i64>(0)).unwrap(),2);
}

fn fiscal_draft(sale:String)->fiscal::Draft{
    fiscal::Draft{sale,receiver:fiscal::Receiver{rfc:"URE180429TM6".into(),name:"UNIVERSIDAD ROBOTICA ESPAÑOLA".into(),regime:"601".into(),zip:"86991".into(),usage:"G03".into()},expedition:"78000".into(),payment_form:"01".into(),items:vec![fiscal::TaxLine{product_code:"01010101".into(),unit_code:"H87".into(),tax:"iva16".into()}]}
}

#[test]
fn rpc_binds_sessions_to_register_and_filters_snapshot(){
    let db=database();cashier(&db);
    db.execute("INSERT INTO registers(id,name,token) VALUES(2,'Caja 2','pair-two')",[]).unwrap();
    let path=std::env::temp_dir().join(format!("grid-test-{}",Uuid::new_v4()));
    let store=Store{_instance:std::fs::File::create(&path).unwrap(),db:Mutex::new(db),directory:std::env::temp_dir(),sessions:Mutex::new(std::collections::HashMap::from([("one".into(),(1,std::time::Instant::now(),1)),("two".into(),(1,std::time::Instant::now(),2))])),grants:Mutex::new(Default::default())};
    assert!(network::process(&store,"wrong-pair","auth_status",json!({})).is_err());
    assert!(network::process(&store,"pair-two","snapshot",json!({"sessionToken":"one"})).is_err());
    assert!(network::process(&store,"pair-two","snapshot",json!([])).is_err());
    let open=json!({"sessionToken":"two","requestId":Uuid::new_v4().to_string(),"action":{"type":"open","amount":0}});
    network::process(&store,"pair-two","mutate",open).unwrap();
    network::process(&store,"pair-two","mutate",json!({"sessionToken":"two","requestId":Uuid::new_v4().to_string(),"action":{"type":"common","ticket":1,"name":"Solo en caja 2","quantity":1000,"price":500,"cost":null}})).unwrap();
    let second=network::process(&store,"pair-two","snapshot",json!({"sessionToken":"two"})).unwrap();
    assert_eq!(second["lines"][0]["ticket"],1);assert_eq!(second["shift"].as_array().unwrap().len(),1);
    let first=rpc::dispatch(&store,"snapshot",json!({"sessionToken":"one"})).unwrap();assert_eq!(first["lines"],json!([]));assert_eq!(first["common_products"],json!([]));
    assert!(network::process(&store,"pair-two","mutate",json!({"sessionToken":"two","requestId":Uuid::new_v4().to_string(),"action":{"type":"remove","ticket":6,"product":-1}})).is_err());
    drop(store);std::fs::remove_file(path).unwrap();
}

#[test]
fn network_tls_accepts_only_paired_certificate(){
    let cert=rcgen::generate_simple_self_signed(vec!["127.0.0.1".into()]).unwrap();
    let server=tiny_http::Server::https("127.0.0.1:0",tiny_http::SslConfig{certificate:cert.cert.pem().into_bytes(),private_key:cert.key_pair.serialize_pem().into_bytes()}).unwrap();
    let address=server.server_addr().to_ip().unwrap();
    let worker=std::thread::spawn(move||{let req=server.recv_timeout(std::time::Duration::from_secs(5)).unwrap().unwrap();req.respond(tiny_http::Response::from_string("ok")).unwrap();});
    let response=network::client(&cert.cert.pem()).unwrap().get(format!("https://{address}")).send().unwrap();assert_eq!(response.text().unwrap(),"ok");worker.join().unwrap();
    let cert2=rcgen::generate_simple_self_signed(vec!["127.0.0.1".into()]).unwrap();
    let server=tiny_http::Server::https("127.0.0.1:0",tiny_http::SslConfig{certificate:cert.cert.pem().into_bytes(),private_key:cert.key_pair.serialize_pem().into_bytes()}).unwrap();
    let address=server.server_addr().to_ip().unwrap();
    assert!(network::client(&cert2.cert.pem()).unwrap().get(format!("https://{address}")).send().is_err());
}
#[test]
fn fiscal_uses_ticket_amount_and_never_invents_a_stamp(){
    let mut db=database();let actor=cashier(&db);retail::add_common(&db,1,"Servicio",1000,11600,None).unwrap();
    let sale=Uuid::new_v4().to_string();business::checkout_transaction(&mut db,&actor,1,sale.clone(),11600,None,None).unwrap();
    let prepared=fiscal::prepare(&mut db,&actor,fiscal_draft(sale.clone())).unwrap();let body=&prepared["payload"];
    assert_eq!(body["Items"][0]["Subtotal"],100.0);assert_eq!(body["Items"][0]["Taxes"][0]["Total"],16.0);assert_eq!(body["Items"][0]["Total"],116.0);
    assert!(fiscal::verify_result(&json!({"Id":"fake","Folio":body["Folio"]}),body).is_err());
    let result=json!({"Id":"sandbox123","Folio":body["Folio"],"Total":116.0,"Receiver":body["Receiver"],"Complement":{"TaxStamp":{"Uuid":Uuid::new_v4().to_string()}}});
    assert!(fiscal::verify_result(&result,body).is_ok());let mut wrong=result;wrong["Total"]=json!(999);assert!(fiscal::verify_result(&wrong,body).is_err());
    db.execute("UPDATE fiscal_documents SET state='sending'",[]).unwrap();assert!(fiscal::prepare(&mut db,&actor,fiscal_draft(sale)).is_err());
}

fn database() -> Connection {
    let mut db=Connection::open_in_memory().unwrap();
    initialize(&mut db).unwrap();
    db
}
fn cashier(db:&Connection)->security::Actor {
    db.execute("INSERT INTO users(id,username,name,password_hash,role) VALUES(1,'test','Prueba','not-a-login','owner')",[]).unwrap();
    db.execute("INSERT INTO shifts(opening,user_id) VALUES(0,1)",[]).unwrap();
    security::Actor{id:1,name:"Prueba".into(),role:"owner".into(),permissions:vec![]}
}

#[test]
fn fresh_install_and_second_start_preserve_catalog() {
    let mut db=database();
    assert!(db.is_autocommit());
    let count:i64=db.query_row("SELECT count(*) FROM products",[],|r|r.get(0)).unwrap();
    assert_eq!(count,1309);
    db.execute("UPDATE products SET stock=123000 WHERE id=1",[]).unwrap();
    initialize(&mut db).unwrap();
    assert_eq!(db.query_row("SELECT stock FROM products WHERE id=1",[],|r|r.get::<_,i64>(0)).unwrap(),123000);
    assert_eq!(db.query_row("PRAGMA user_version",[],|r|r.get::<_,i64>(0)).unwrap(),7);
    assert_eq!(db.query_row("SELECT count(*) FROM products WHERE cost=0 AND cost_known=0",[],|r|r.get::<_,i64>(0)).unwrap(),999);
}

#[test]
fn failed_seed_rolls_back_and_can_be_retried() {
    let mut db=database();
    db.execute("DELETE FROM settings WHERE key='catalog_seeded'",[]).unwrap();
    db.execute_batch("CREATE TRIGGER fail_seed BEFORE INSERT ON products BEGIN SELECT RAISE(ABORT,'test failure'); END;").unwrap();
    assert!(initialize(&mut db).is_err());
    assert!(db.is_autocommit());
    assert_eq!(db.query_row("SELECT count(*) FROM settings WHERE key='catalog_seeded'",[],|r|r.get::<_,i64>(0)).unwrap(),0);
    db.execute_batch("DROP TRIGGER fail_seed;").unwrap();
    initialize(&mut db).unwrap();
}

#[test]
fn common_product_checkout_is_persistent_idempotent_and_has_no_stock_effect() {
    let mut db=database();let actor=cashier(&db);
    let stock:i64=db.query_row("SELECT sum(stock) FROM products",[],|r|r.get(0)).unwrap();
    retail::add_common(&db,1,"Dulces sueltos",2500,1200,None).unwrap();
    retail::add_common(&db,2,"Otro ticket",1000,100,Some(0)).unwrap();
    let quote=business::quote(&db,1).unwrap();
    assert_eq!(quote["total"],3000);assert_eq!(quote["consumption"],json!([]));
    assert_eq!(quote["items"][0]["name"],"Dulces sueltos");
    assert!(quote["items"][0]["cost"].is_null());
    let id=Uuid::new_v4().to_string();
    let receipt=business::checkout_transaction(&mut db,&actor,1,id.clone(),5000,None,None).unwrap();
    assert_eq!(receipt["change"],2000);
    let retry=business::checkout_transaction(&mut db,&actor,1,id,5000,None,None).unwrap();
    assert_eq!(receipt,retry);
    assert_eq!(db.query_row("SELECT count(*) FROM sales",[],|r|r.get::<_,i64>(0)).unwrap(),1);
    assert_eq!(db.query_row("SELECT count(*) FROM common_cart WHERE ticket=1",[],|r|r.get::<_,i64>(0)).unwrap(),0);
    assert_eq!(db.query_row("SELECT count(*) FROM common_cart WHERE ticket=2",[],|r|r.get::<_,i64>(0)).unwrap(),1);
    assert_eq!(db.query_row("SELECT sum(stock) FROM products",[],|r|r.get::<_,i64>(0)).unwrap(),stock);
    assert_eq!(cash(&db,1).unwrap(),3000);
    assert_eq!(db.query_row("SELECT missing_cost FROM sale_metrics",[],|r|r.get::<_,i64>(0)).unwrap(),1);
}

#[test]
fn common_validation_and_ticket_isolation() {
    let db=database();
    for (ticket,name,qty,price,cost) in [(0,"Pan",1000,100,None),(1,"",1000,100,None),(1,"Pan",0,100,None),(1,"Pan",1001_000,100,None),(1,"Pan",1000,0,None),(1,"Pan",1000,100,Some(-1))] {
        assert!(retail::add_common(&db,ticket,name,qty,price,cost).is_err());
    }
    retail::add_common(&db,1,"Pan",1000,100,Some(0)).unwrap();
    let id=db.last_insert_rowid();
    assert!(retail::adjust_common(&db,2,id,1000).is_err());
    retail::adjust_common(&db,1,id,1000).unwrap();
    assert_eq!(business::quote(&db,1).unwrap()["total"],200);
    assert_eq!(business::quote(&db,1).unwrap()["items"][0]["cost_known"],true);
    retail::adjust_common(&db,1,id,-2000).unwrap();
    assert!(business::quote(&db,1).is_err());
}

#[test]
fn missing_cost_is_not_a_free_product_and_mixed_sale_consumes_only_catalog_stock() {
    let mut db=database();let actor=cashier(&db);
    db.execute("INSERT INTO products(code,name,category,icon,price,cost,unit,stock,cost_known) VALUES('TEST','Prueba','Prueba','auto',2000,0,'pieza',2000,0)",[]).unwrap();
    let id=db.last_insert_rowid();
    db.execute("INSERT INTO cart(ticket,product,quantity) VALUES(1,?,1000)",[id]).unwrap();
    retail::add_common(&db,1,"Servicio",1000,500,Some(100)).unwrap();
    let quote=business::quote(&db,1).unwrap();
    assert_eq!(quote["total"],2500);
    assert!(quote["items"][0]["cost"].is_null());
    assert_eq!(quote["consumption"].as_array().unwrap().len(),1);
    business::checkout_transaction(&mut db,&actor,1,Uuid::new_v4().to_string(),2500,None,None).unwrap();
    assert_eq!(db.query_row("SELECT stock FROM products WHERE id=?",[id],|r|r.get::<_,i64>(0)).unwrap(),1000);
}

#[test]
fn unit_correction_preserves_quantity_and_rejects_historical_changes() {
    let db=database();
    let id:i64=db.query_row("SELECT id FROM products WHERE name='Quesillo Oaxaca'",[],|r|r.get(0)).unwrap();
    retail::correct_unit(&db,id,"kg").unwrap();
    assert_eq!(db.query_row("SELECT stock FROM products WHERE id=?",[id],|r|r.get::<_,i64>(0)).unwrap(),870);
    assert!(retail::correct_unit(&db,id,"pieza").is_err());
    db.execute("INSERT INTO inventory(product,quantity,note) VALUES(?,1000,'Prueba')",[id]).unwrap();
    assert!(retail::correct_unit(&db,id,"kg").is_err());
}

#[test]
fn rejected_checkout_keeps_the_common_ticket_and_does_not_record_a_sale() {
    let mut db=database();let actor=cashier(&db);
    retail::add_common(&db,1,"Servicio",1000,500,None).unwrap();
    assert!(business::checkout_transaction(&mut db,&actor,1,Uuid::new_v4().to_string(),100,None,None).is_err());
    assert_eq!(business::quote(&db,1).unwrap()["total"],500);
    assert_eq!(db.query_row("SELECT count(*) FROM sales",[],|r|r.get::<_,i64>(0)).unwrap(),0);
    assert_eq!(cash(&db,1).unwrap(),0);
}

#[test]
fn migration_from_v5_preserves_stock_and_marks_unknown_costs() {
    let mut db=Connection::open_in_memory().unwrap();
    db.execute_batch(include_str!("schema.sql")).unwrap();
    migrations::migrate(&mut db).unwrap();advanced::migrate(&mut db).unwrap();commerce::migrate(&mut db).unwrap();
    db.execute("INSERT INTO products(code,name,category,icon,price,cost,unit,stock) VALUES('LEGACY','Anterior','Prueba','auto',500,0,'pieza',870)",[]).unwrap();
    retail::migrate(&mut db).unwrap();retail::migrate(&mut db).unwrap();
    assert_eq!(db.query_row("SELECT stock,cost_known FROM products WHERE code='LEGACY'",[],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,i64>(1)?))).unwrap(),(870,0));
    assert!(db.is_autocommit());
}
