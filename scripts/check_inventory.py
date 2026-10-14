import csv
from collections import Counter

with open('scripts/mario_inventory_raw.tsv', encoding='utf-8') as f:
    reader = csv.reader(f, delimiter='\t')
    header = next(reader)
    rows = list(reader)

print('Header:', header)
print('Total rows:', len(rows))

codes = []
for r in rows:
    if len(r) >= 2:
        codes.append(r[0].strip())

code_counts = Counter(codes)
dups = {k: v for k, v in code_counts.items() if v > 1}
print('Duplicate codes:', len(dups))
for k, v in list(dups.items())[:15]:
    print(f'Code "{k}": {v} occurrences')
