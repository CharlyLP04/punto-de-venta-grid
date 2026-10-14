import csv, sqlite3, sys
import prepare_mario_catalog as mc

db_path = r'C:\Users\col28\AppData\Roaming\mx.grid.pos\grid.sqlite'
tsv_path = r'scripts\catalog_inventory_raw.tsv'

print(f"Connecting to {db_path}...")
conn = sqlite3.connect(db_path, timeout=10.0)
cur = conn.cursor()

with open(tsv_path, encoding='utf-8') as f:
    reader = csv.reader(f, delimiter='\t')
    header = next(reader)
    rows = list(reader)

print(f"Loaded {len(rows)} rows from TSV.")

inserted = 0
updated = 0

cur.execute("BEGIN TRANSACTION")

for idx, r in enumerate(rows):
    raw_code = r[0].strip()
    raw_name = r[1].strip()
    cost_str = r[2].strip()
    price_str = r[3].strip()
    wholesale_str = r[4].strip()
    inv_str = r[5].strip()
    min_str = r[6].strip()
    raw_dept = r[7].strip()

    name = mc.clean_text(raw_name)
    dept = mc.normalize_dept(raw_dept)
    unit = mc.detect_unit(raw_code, name, dept, inv_str)
    icon = mc.choose_icon(name, dept)
    price = mc.parse_money_to_cents(price_str)
    cost = mc.parse_money_to_cents(cost_str)
    wholesale_price = mc.parse_money_to_cents(wholesale_str)
    stock = mc.parse_stock_to_milli(inv_str, unit)
    minimum = mc.parse_stock_to_milli(min_str, unit)
    if minimum <= 0:
        minimum = 1000 if unit == 'pieza' else 500
    target = max(minimum * 4, stock * 2, 4000)

    if price <= 0:
        price = 1000  # fallback 10 pesos

    # Check if product code already exists
    cur.execute("SELECT id FROM products WHERE code = ?", (raw_code,))
    existing = cur.fetchone()

    if existing:
        prod_id = existing[0]
        cur.execute("""
            UPDATE products 
            SET name=?, category=?, icon=?, price=?, cost=?, unit=?, stock=?, minimum=?, target=?, wholesale_price=?, enabled=1
            WHERE id=?
        """, (name, dept, icon, price, cost, unit, stock, minimum, target, wholesale_price, prod_id))
        updated += 1
    else:
        cur.execute("""
            INSERT INTO products(code, name, category, icon, price, cost, unit, stock, minimum, target, wholesale_quantity, wholesale_price, favorite, created, enabled)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, strftime('%Y-%m-%dT%H:%M:%fZ','now'), 1)
        """, (raw_code, name, dept, icon, price, cost, unit, stock, minimum, target, wholesale_price))
        prod_id = cur.lastrowid
        inserted += 1

    # Ensure product_codes table is synchronized
    cur.execute("INSERT OR REPLACE INTO product_codes(code, product) VALUES(?, ?)", (raw_code, prod_id))

conn.commit()

cur.execute("SELECT count(*) FROM products")
total_prods = cur.fetchone()[0]

cur.execute("SELECT count(*) FROM product_codes")
total_codes = cur.fetchone()[0]

print(f"Import complete! Inserted: {inserted}, Updated: {updated}")
print(f"Total products in DB: {total_prods}")
print(f"Total codes in DB: {total_codes}")

conn.close()

