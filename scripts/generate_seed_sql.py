import csv
import prepare_mario_catalog as mc

tsv_path = r'scripts\catalog_inventory_raw.tsv'
sql_path = r'src-tauri\src\inventory_seed.sql'

with open(tsv_path, encoding='utf-8') as f:
    reader = csv.reader(f, delimiter='\t')
    header = next(reader)
    rows = list(reader)

lines = []
lines.append("-- Semilla de catálogo real de Grid POS (1,309 productos)")
lines.append("-- Transaction managed by initialize; seed and markers commit together.")

for idx, r in enumerate(rows):
    raw_code = r[0].strip().replace("'", "''")
    raw_name = r[1].strip()
    cost_str = r[2].strip()
    price_str = r[3].strip()
    wholesale_str = r[4].strip()
    inv_str = r[5].strip()
    min_str = r[6].strip()
    raw_dept = r[7].strip()

    name = mc.clean_text(raw_name).replace("'", "''")
    dept = mc.normalize_dept(raw_dept).replace("'", "''")
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
        price = 1000

    lines.append(f"INSERT OR IGNORE INTO products(code,name,category,icon,price,cost,unit,stock,minimum,target,wholesale_quantity,wholesale_price,favorite,created,enabled) VALUES('{raw_code}','{name}','{dept}','{icon}',{price},{cost},'{unit}',{stock},{minimum},{target},0,{wholesale_price},0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),1);")
    lines.append(f"INSERT OR REPLACE INTO product_codes(code,product) SELECT '{raw_code}',id FROM products WHERE code='{raw_code}';")

lines.append("-- End of catalog seed.")

with open(sql_path, 'w', encoding='utf-8') as f:
    f.write("\n".join(lines) + "\n")

print(f"Generated {sql_path} with {len(rows)} product seeds!")

