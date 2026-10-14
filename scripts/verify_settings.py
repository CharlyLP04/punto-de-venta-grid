import sqlite3

db_path = r'C:\Users\col28\AppData\Roaming\mx.grid.pos\grid.sqlite'
conn = sqlite3.connect(db_path)
cur = conn.cursor()

prods = cur.execute('SELECT count(*) FROM products').fetchone()[0]
cur.execute("INSERT OR REPLACE INTO settings(key, value) VALUES('catalog_seeded', '1')")
cur.execute("INSERT OR REPLACE INTO settings(key, value) VALUES('seeded', '1')")
conn.commit()

settings = cur.execute('SELECT * FROM settings').fetchall()
print(f"Verified products: {prods}")
print(f"Settings: {settings}")

conn.close()

