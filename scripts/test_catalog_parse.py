import csv
from collections import Counter
import prepare_mario_catalog as mc

with open('scripts/mario_inventory_raw.tsv', encoding='utf-8') as f:
    reader = csv.reader(f, delimiter='\t')
    header = next(reader)
    rows = list(reader)

items = []
icons = Counter()
depts = Counter()
units = Counter()

for r in rows:
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
    stock = mc.parse_stock_to_milli(inv_str, unit)
    minimum = mc.parse_stock_to_milli(min_str, unit)

    if price <= 0:
        price = 1000 # default 10 pesos if invalid

    items.append({
        'code': raw_code,
        'name': name,
        'category': dept,
        'icon': icon,
        'price': price,
        'cost': cost,
        'unit': unit,
        'stock': stock,
        'minimum': minimum
    })
    icons[icon] += 1
    depts[dept] += 1
    units[unit] += 1

print(f"Parsed {len(items)} items successfully!")
print(f"Units distribution: {dict(units)}")
print("\nTop 15 Categories:")
for d, c in depts.most_common(15):
    print(f"  {d}: {c}")
print("\nTop 15 Icons:")
for ic, c in icons.most_common(15):
    print(f"  {ic}: {c}")
