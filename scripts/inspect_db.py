import sqlite3

db_path = r'C:\Users\col28\AppData\Roaming\mx.grid.mario-pos\mario.sqlite'
conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute("SELECT count(*) FROM products")
count = cur.fetchone()[0]
print(f"Current products in DB: {count}")

cur.execute("SELECT id, code, name, category, icon, price, cost, unit, stock FROM products LIMIT 15")
rows = cur.fetchall()
for r in rows:
    print(r)

conn.close()
