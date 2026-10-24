"""
Alembic env.py — Kabayan AI migration configuration.

Uses database.py engine and config.STORAGE_DIR for the database path.
"""

import sys
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Import AFTER sys.path setup
import app.config as app_config
from app.database import Base

# Wajib di-import agar Base.metadata berisi seluruh tabel. Tanpa ini
# Alembic menganggap database memiliki tabel yang tidak dikenal dan
# `alembic check`/autogenerate bisa menghasilkan drop_table.
from app import models  # noqa: F401

# Alembic Config object
config = context.config

# Override sqlalchemy.url from app config
db_path = os.path.join(app_config.STORAGE_DIR, "kabayan.db")
config.set_main_option("sqlalchemy.url", f"sqlite:///{db_path}")

# Logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()