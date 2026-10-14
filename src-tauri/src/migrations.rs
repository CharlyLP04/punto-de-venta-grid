use crate::{err, Result};
use rusqlite::Connection;

pub fn migrate(db: &mut Connection) -> Result<()> {
    let version: i64 = db.query_row("PRAGMA user_version", [], |r| r.get(0)).map_err(err)?;
    if version >= 2 { return Ok(()); }
    let tx = db.transaction().map_err(err)?;
    tx.execute_batch(r#"
        CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT NOT NULL UNIQUE COLLATE NOCASE,name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL,permissions TEXT NOT NULL DEFAULT '[]',enabled INTEGER NOT NULL DEFAULT 1,failures INTEGER NOT NULL DEFAULT 0,locked_until INTEGER NOT NULL DEFAULT 0);
        ALTER TABLE sales ADD COLUMN user_id INTEGER REFERENCES users(id);
        ALTER TABLE sales ADD COLUMN customer_id INTEGER REFERENCES customers(id);
        ALTER TABLE shifts ADD COLUMN user_id INTEGER REFERENCES users(id);
        ALTER TABLE movements ADD COLUMN user_id INTEGER REFERENCES users(id);
        ALTER TABLE audit ADD COLUMN user_id INTEGER REFERENCES users(id);
        ALTER TABLE products ADD COLUMN minimum INTEGER NOT NULL DEFAULT 3000;
        ALTER TABLE products ADD COLUMN target INTEGER NOT NULL DEFAULT 12000;
        ALTER TABLE products ADD COLUMN wholesale_quantity INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE products ADD COLUMN wholesale_price INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE products ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE products ADD COLUMN created TEXT;
        UPDATE products SET created=strftime('%Y-%m-%dT%H:%M:%fZ','now');
        CREATE TABLE cart_new(ticket INTEGER NOT NULL CHECK(ticket BETWEEN 1 AND 5),product INTEGER NOT NULL REFERENCES products(id),quantity INTEGER NOT NULL,override_price INTEGER,reason TEXT,PRIMARY KEY(ticket,product));
        INSERT INTO cart_new(ticket,product,quantity) SELECT ticket,product,quantity FROM cart;
        DROP TABLE cart;
        ALTER TABLE cart_new RENAME TO cart;
        CREATE TABLE product_codes(code TEXT PRIMARY KEY,product INTEGER NOT NULL REFERENCES products(id));
        INSERT INTO product_codes SELECT code,id FROM products;
        CREATE TABLE combo_items(combo INTEGER NOT NULL REFERENCES products(id),product INTEGER NOT NULL REFERENCES products(id),quantity INTEGER NOT NULL CHECK(quantity>0),PRIMARY KEY(combo,product),CHECK(combo<>product));
        CREATE TABLE payments(sale TEXT NOT NULL REFERENCES sales(id),method TEXT NOT NULL CHECK(method IN ('cash','card','credit')),amount INTEGER NOT NULL CHECK(amount>=0),reference TEXT NOT NULL DEFAULT '',PRIMARY KEY(sale,method));
        INSERT INTO payments(sale,method,amount) SELECT id,payment,total FROM sales;
        CREATE TABLE refunds(id TEXT PRIMARY KEY,sale TEXT NOT NULL UNIQUE REFERENCES sales(id),user_id INTEGER NOT NULL REFERENCES users(id),shift INTEGER NOT NULL REFERENCES shifts(id),reason TEXT NOT NULL,receipt TEXT NOT NULL,created TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
        CREATE TABLE purchases(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),supplier TEXT NOT NULL,folio TEXT NOT NULL,total INTEGER NOT NULL,created TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
        CREATE TABLE purchase_items(purchase TEXT NOT NULL REFERENCES purchases(id),product INTEGER NOT NULL REFERENCES products(id),quantity INTEGER NOT NULL,cost INTEGER NOT NULL,PRIMARY KEY(purchase,product));
        CREATE TABLE losses(id TEXT PRIMARY KEY,product INTEGER NOT NULL REFERENCES products(id),quantity INTEGER NOT NULL,cost INTEGER NOT NULL,reason TEXT NOT NULL,user_id INTEGER NOT NULL REFERENCES users(id),created TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
        CREATE TABLE repayment_receipts(id TEXT PRIMARY KEY,customer INTEGER NOT NULL REFERENCES customers(id),amount INTEGER NOT NULL,previous_balance INTEGER NOT NULL,balance INTEGER NOT NULL,user_id INTEGER NOT NULL REFERENCES users(id),created TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
        CREATE TABLE requests(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,body TEXT NOT NULL,response TEXT NOT NULL);
        CREATE VIEW sale_metrics AS
          SELECT s.id AS sale,s.created,s.user_id,s.total AS revenue,
            coalesce((SELECT sum(json_extract(j.value,'$.cost')) FROM json_each(s.receipt,'$.items') j),0) AS cost,
            CASE WHEN json_type(s.receipt,'$.items[0].cost') IS NULL THEN 1 ELSE 0 END AS missing_cost
          FROM sales s
          UNION ALL
          SELECT s.id,r.created,r.user_id,-s.total,
            -coalesce((SELECT sum(json_extract(j.value,'$.cost')) FROM json_each(r.receipt,'$.items') j),0),
            CASE WHEN json_type(r.receipt,'$.items[0].cost') IS NULL THEN 1 ELSE 0 END
          FROM refunds r JOIN sales s ON s.id=r.sale;
        CREATE VIEW item_metrics AS
          SELECT json_extract(j.value,'$.id') AS product,json_extract(j.value,'$.name') AS name,
            json_extract(j.value,'$.subtotal')-json_extract(j.value,'$.cost') AS margin,s.created
          FROM sales s,json_each(s.receipt,'$.items') j
          UNION ALL
          SELECT json_extract(j.value,'$.id'),json_extract(j.value,'$.name'),
            -(json_extract(j.value,'$.subtotal')-json_extract(j.value,'$.cost')),r.created
          FROM refunds r,json_each(r.receipt,'$.items') j;
        INSERT OR IGNORE INTO settings VALUES('store_name','Punto de Venta Grid'),('receipt_footer','Gracias por tu compra'),('store_address',''),('store_phone',''),('accent','emerald'),('density','comfortable'),('idle_minutes','15'),('daily_goal','600000');
        DELETE FROM settings WHERE key='admin_pin';
        PRAGMA user_version=2;
    "#).map_err(err)?;
    tx.commit().map_err(err)
}
