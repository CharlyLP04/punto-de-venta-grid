import sqlite3

db_path = r'C:\Users\col28\AppData\Roaming\mx.grid.mario-pos\mario.sqlite'
try:
    conn = sqlite3.connect(db_path, timeout=5.0)
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM products")
    print("Products count:", cur.fetchone()[0])
    conn.close()
    print("Database is accessible!")
except Exception as e:
    print("Error:", e)
