"""Fixtures uji — isolasi total dari data asli.

- Storage diarahkan ke tmp_path (uploads, trash) agar tidak
  menyentuh storage/ milik user.
- DB memakai SQLite temporer per-tes (bukan storage/kabayan.db).
- SessionLocal service (material_service) dialihkan ke
  sessionmaker uji agar jalur worker ikut memakai DB temporer.
"""
import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base
import config
import models  # noqa: F401 — daftarkan semua tabel ke Base.metadata


@pytest.fixture(autouse=True)
def _clear_app_dependency_overrides():
    """Cegah kebocoran app.dependency_overrides antar-test.

    Test yang memakai TestClient biasanya men-set override get_db ke
    session test-nya sendiri; tanpa pembersihan, override lama masih
    menunjuk ke engine yang sudah di-drop setelah fixture db_session
    selesai → endpoint berikutnya dapat 500 tak jelas.
    """
    yield
    from main import app
    app.dependency_overrides.clear()


@pytest.fixture()
def db_session(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "BASE_DIR", str(tmp_path))
    monkeypatch.setattr(config, "UPLOADS_DIR", str(tmp_path / "storage" / "uploads"))
    monkeypatch.setattr(config, "TRASH_DIR", str(tmp_path / "storage" / "trash"))
    os.makedirs(config.UPLOADS_DIR, exist_ok=True)
    os.makedirs(config.TRASH_DIR, exist_ok=True)

    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    import services.material_service as _material_service
    _material_service.SessionLocal = TestingSession

    db = TestingSession()
    yield db
    db.close()
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def make_subject(db_session):
    def _make(name="Matkul Uji"):
        subject = models.Subject(name=name)
        db_session.add(subject)
        db_session.commit()
        db_session.refresh(subject)
        return subject
    return _make


@pytest.fixture()
def make_material(db_session):
    def _make(subject_id, status="Pending", filepath=None, filename="a.pdf"):
        mat = models.Material(
            subject_id=subject_id,
            filename=filename,
            filepath=filepath,
            status=status,
            progress=0,
        )
        db_session.add(mat)
        db_session.commit()
        db_session.refresh(mat)
        return mat
    return _make
