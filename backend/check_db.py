import os
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.db.session import DATABASE_URL

db_path = DATABASE_URL.split(":///", 1)[-1]
print(f"Checking DB at: {db_path} (from {DATABASE_URL})")

try:
    c = sqlite3.connect(db_path)
    tables = c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    print("Tables:", tables)
except Exception as e:
    print("Error:", e)
