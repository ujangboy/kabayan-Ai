"""Verifikasi E2E: pesan vision ter-persist di DB (read-only)."""
import sqlite3

db = sqlite3.connect("storage/kabayan.db")
rows = db.execute(
    "select id, role, substr(content,1,100) from messages "
    "where chat_id=(select id from chats order by created_at desc limit 1) "
    "order by id desc limit 4"
).fetchall()
for r in rows:
    print(r)
