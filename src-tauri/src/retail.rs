use crate::{err, positive, valid_ticket, Result};
use rusqlite::{params, Connection};

pub fn migrate(db: &mut Connection) -> Result<()> {
    let version: i64 = db.query_row("PRAGMA user_version", [], |r| r.get(0)).map_err(err)?;
    if version >= 6 { return Ok(()); }
    let tx = db.transaction().map_err(err)?;
    tx.execute_batch(include_str!("retail.sql")).map_err(err)?;
    tx.commit().map_err(err)
}

pub fn add_common(db: &Connection, ticket: i64, name: &str, quantity: i64, price: i64, cost: Option<i64>) -> Result<()> {
    valid_ticket(ticket)?;
    positive(price)?;
    if name.trim().is_empty() || name.chars().count() > 120 || name.chars().any(char::is_control)
        || !(1..=1_000_000).contains(&quantity) || cost.is_some_and(|n| !(0..=100_000_000).contains(&n)) {
        return Err("Indica descripción, cantidad de hasta 1,000 y precio válidos".into());
    }
    positive((price * quantity + 500) / 1000)?;
    db.execute("INSERT INTO common_cart(ticket,name,quantity,price,cost) VALUES(?,?,?,?,?)", params![ticket,name.trim(),quantity,price,cost]).map_err(err)?;
    Ok(())
}

pub fn adjust_common(db: &Connection, ticket: i64, id: i64, delta: i64) -> Result<()> {
    valid_ticket(ticket)?;
    if delta == 0 || delta.unsigned_abs() > 1_000_000 { return Err("Cantidad inválida".into()); }
    let current: i64 = db.query_row("SELECT quantity FROM common_cart WHERE ticket=? AND id=?", params![ticket,id], |r|r.get(0)).map_err(err)?;
    let next = current.checked_add(delta).ok_or("Cantidad fuera de rango")?;
    if next > 1_000_000 { return Err("Máximo 1,000 unidades por línea".into()); }
    if next <= 0 { db.execute("DELETE FROM common_cart WHERE ticket=? AND id=?", params![ticket,id]).map_err(err)?; }
    else { db.execute("UPDATE common_cart SET quantity=? WHERE ticket=? AND id=?", params![next,ticket,id]).map_err(err)?; }
    Ok(())
}

// Only unused catalog entries can change unit: historical quantities must retain their meaning.
pub fn correct_unit(db: &Connection, product: i64, unit: &str) -> Result<()> {
    if !["kg","pieza"].contains(&unit) { return Err("Unidad inválida".into()); }
    let used: i64 = db.query_row("SELECT (SELECT count(*) FROM inventory WHERE product=?1)+(SELECT count(*) FROM cart WHERE product=?1)+(SELECT count(*) FROM lots WHERE product=?1)+(SELECT count(*) FROM combo_items WHERE product=?1 OR combo=?1)+(SELECT count(*) FROM purchase_items WHERE product=?1)+(SELECT count(*) FROM sales s,json_each(s.receipt,'$.items') j WHERE json_extract(j.value,'$.id')=?1)", [product], |r|r.get(0)).map_err(err)?;
    if used > 0 { return Err("Este producto ya tiene movimientos, lotes o combos. Conserva su unidad y crea otro producto con la unidad correcta.".into()); }
    let stock: i64 = db.query_row("SELECT stock FROM products WHERE id=?", [product], |r|r.get(0)).map_err(err)?;
    if unit == "pieza" && stock % 1000 != 0 { return Err("Primero corrige las existencias con un conteo de piezas enteras".into()); }
    db.execute("UPDATE products SET unit=? WHERE id=?", params![unit,product]).map_err(err)?;
    Ok(())
}
