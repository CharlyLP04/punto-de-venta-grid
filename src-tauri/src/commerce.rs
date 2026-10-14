use crate::{err,Result};
use rusqlite::Connection;

pub fn migrate(db:&mut Connection)->Result<()> {
    let version:i64=db.query_row("PRAGMA user_version",[],|r|r.get(0)).map_err(err)?;
    if version>=5{return Ok(());}
    let tx=db.transaction().map_err(err)?;
    tx.execute_batch("CREATE TABLE payments_v5(sale TEXT NOT NULL REFERENCES sales(id),method TEXT NOT NULL CHECK(method IN ('cash','card','credit','transfer','voucher','check','usd')),amount INTEGER NOT NULL CHECK(amount>=0),reference TEXT NOT NULL DEFAULT '',PRIMARY KEY(sale,method));
      INSERT INTO payments_v5 SELECT * FROM payments;
      DROP TABLE payments; ALTER TABLE payments_v5 RENAME TO payments;
      CREATE TABLE suppliers(id INTEGER PRIMARY KEY,name TEXT NOT NULL,phone TEXT NOT NULL DEFAULT '',email TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',enabled INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE purchase_orders(id TEXT PRIMARY KEY,supplier INTEGER NOT NULL REFERENCES suppliers(id),status TEXT NOT NULL CHECK(status IN ('draft','received','cancelled')),body TEXT NOT NULL,user_id INTEGER NOT NULL REFERENCES users(id),created TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
      ALTER TABLE customers ADD COLUMN email TEXT NOT NULL DEFAULT '';
      ALTER TABLE customers ADD COLUMN address TEXT NOT NULL DEFAULT '';
      ALTER TABLE customers ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE customers ADD COLUMN credit_enabled INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE products ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1;
      PRAGMA user_version=5;").map_err(err)?;
    tx.commit().map_err(err)
}
