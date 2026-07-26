import sqlite3
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(__file__)))
import config

db_path = os.path.join(config.STORAGE_DIR, "kabayan.db")
if not os.path.exists(db_path):
    print("Database not found at:", db_path)
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get existing columns
cursor.execute("PRAGMA table_info(materials)")
columns = [col[1] for col in cursor.fetchall()]

try:
    if "material_type" not in columns:
        cursor.execute("ALTER TABLE materials ADD COLUMN material_type VARCHAR DEFAULT 'PDF'")
    if "source_url" not in columns:
        cursor.execute("ALTER TABLE materials ADD COLUMN source_url VARCHAR")
    if "external_id" not in columns:
        cursor.execute("ALTER TABLE materials ADD COLUMN external_id VARCHAR")
    if "thumbnail" not in columns:
        cursor.execute("ALTER TABLE materials ADD COLUMN thumbnail VARCHAR")
    if "language" not in columns:
        cursor.execute("ALTER TABLE materials ADD COLUMN language VARCHAR")
    if "status" not in columns:
        cursor.execute("ALTER TABLE materials ADD COLUMN status VARCHAR DEFAULT 'Ready'")
    if "created_at" not in columns:
        cursor.execute("ALTER TABLE materials ADD COLUMN created_at DATETIME")
    if "updated_at" not in columns:
        cursor.execute("ALTER TABLE materials ADD COLUMN updated_at DATETIME")
    
    conn.commit()
    print("Migration successful: added columns to materials table.")
except Exception as e:
    print(f"Error during migration: {e}")
finally:
    conn.close()

# Also we need to make sure Base.metadata.create_all is run to create youtube_metadata table
import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from database import Base, engine
import models
Base.metadata.create_all(bind=engine)
print("Created new tables (e.g., youtube_metadata) if they didn't exist.")
