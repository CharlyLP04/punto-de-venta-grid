import csv

with open('scripts/catalog_inventory_raw.tsv', encoding='utf-8') as f:
    reader = csv.reader(f, delimiter='\t')
    header = next(reader)
    rows = list(reader)

empty_codes = 0
short_codes = []
for idx, r in enumerate(rows):
    code = r[0].strip()
    name = r[1].strip()
    if not code:
        empty_codes += 1
        print(f"Row {idx+2} has empty code: name='{name}'")
    elif len(code) <= 5:
        short_codes.append((code, name))

print(f"Total empty codes: {empty_codes}")
print(f"Total short codes (<=5 chars): {len(short_codes)}")
print("Sample short codes:", short_codes[:10])

