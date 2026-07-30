"""
Kabayan AI — Database engine with WAL mode + QueuePool.

Optimizations:
  - WAL journal mode for concurrent reads + single writer
  - QueuePool (pool_size=5, max_overflow=15) for up to 20 concurrent connections
  - busy_timeout=15000 to avoid "database is locked" errors
  - synchronous=NORMAL (fsync per checkpoint, not per transaction)
  - wal_autocheckpoint=1000 (checkpoint every ~4MB)
  - Monitoring via get_pool_status() and get_wal_stats()
"""

import os
import time
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import QueuePool
import config

db_path = os.path.join(config.STORAGE_DIR, "kabayan.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_path}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    poolclass=QueuePool,
    pool_size=5,
    max_overflow=15,
    pool_pre_ping=True,
    pool_recycle=3600,
    connect_args={"timeout": 15, "check_same_thread": False},
)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA busy_timeout=15000")
    cursor.execute("PRAGMA wal_autocheckpoint=1000")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def get_pool_status():
    pool = engine.pool
    return {
        "size": pool.size(),
        "checked_in": pool.checkedin(),
        "overflow": pool.overflow(),
        "checked_out": pool.checkedout(),
    }

def get_wal_stats():
    wal_path = db_path + "-wal"
    shm_path = db_path + "-shm"
    stats = {
        "db_size_mb": round(os.path.getsize(db_path) / (1024 * 1024), 2) if os.path.exists(db_path) else 0,
        "wal_size_mb": round(os.path.getsize(wal_path) / (1024 * 1024), 2) if os.path.exists(wal_path) else 0,
        "shm_size_mb": round(os.path.getsize(shm_path) / (1024 * 1024), 2) if os.path.exists(shm_path) else 0,
    }
    return stats

def run_wal_checkpoint():
    with engine.connect() as conn:
        conn.execute(text("PRAGMA wal_checkpoint(TRUNCATE)"))
        conn.commit()