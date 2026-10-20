"""Guard: migrations must produce exactly the schema declared by models."""
import os

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine

import config
import models  # noqa: F401 — register all tables on Base.metadata
from database import Base


def test_fresh_migrations_match_models(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "STORAGE_DIR", str(tmp_path))

    cfg = Config(os.path.join(config.BASE_DIR, "alembic.ini"))
    command.upgrade(cfg, "head")

    db_path = tmp_path / "kabayan.db"
    assert db_path.exists()

    engine = create_engine(f"sqlite:///{db_path}")
    with engine.connect() as conn:
        context = MigrationContext.configure(conn)
        diffs = compare_metadata(context, Base.metadata)

    assert diffs == []
