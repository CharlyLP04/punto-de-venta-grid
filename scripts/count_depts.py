import csv, re

with open('scripts/mario_inventory_raw.tsv', encoding='utf-8') as f:
    reader = csv.reader(f, delimiter='\t')
    header = next(reader)
    rows = list(reader)

depts = Counter(r[7].strip() for r in rows if len(r) >= 8)
for d, count in depts.most_common():
    print(f"{d}: {count}")
