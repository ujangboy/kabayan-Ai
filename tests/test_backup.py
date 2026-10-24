"""
Test Backup/Export (services/backup_service.py + endpoints di routers/data.py).

Fokus uji:
  - ZIP berisi kabayan.db + file upload
  - DB di dalam ZIP bisa dibuka & memuat data yang sama (snapshot konsisten)
  - Metadata create: filename, size, files
  - Backup lama dibersihkan (sisakan 5 terbaru)
  - Path traversal ditolak di endpoint download
  - Cleanup otomatis saat create (tidak menumpuk)
"""
import datetime
import json
import os
import sqlite3
import zipfile

import pytest

from app import models
from app.database import get_db
from app.services.backup_service import create_backup, list_backups, backup_path_for, BACKUP_PREFIX


@pytest.fixture()
def client(db_session):
    from fastapi.testclient import TestClient
    from app.main import app

    app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def seeded_fs(tmp_path, monkeypatch):
    """Layout storage uji: DB + upload dalam tmp_path (sama dgn db_session)."""
    from app import config

    storage = tmp_path / "storage"
    uploads = storage / "uploads"
    uploads.mkdir(parents=True)
    backups = storage / "backups"
    backups.mkdir(parents=True)

    monkeypatch.setattr(config, "BASE_DIR", str(tmp_path))
    monkeypatch.setattr(config, "STORAGE_DIR", str(storage))
    monkeypatch.setattr(config, "UPLOADS_DIR", str(uploads))
    monkeypatch.setattr(config, "BACKUPS_DIR", str(backups))

    (uploads / "materi.pdf").write_bytes(b"%PDF-materi-uji")
    return {"storage": storage, "uploads": uploads, "backups": backups}


def _write_db(path, rows=3):
    # Idempoten: file bisa jadi sudah punya tabel `subjects` (mis. sisa
    # create_all di engine uji yang menunjuk ke path sama). Pakai IF NOT
    # EXISTS + DELETE agar jumlah baris selalu persis = rows.
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE IF NOT EXISTS subjects (id INTEGER PRIMARY KEY, name TEXT)")
    conn.execute("DELETE FROM subjects")
    for i in range(rows):
        conn.execute("INSERT INTO subjects (name) VALUES (?)", (f"Matkul {i}",))
    conn.commit()
    conn.close()


class TestCreateBackup:
    def test_zip_contains_db_uploads(self, seeded_fs):
        _write_db(str(seeded_fs["storage"] / "kabayan.db"))
        info = create_backup()
        assert info["filename"].startswith(BACKUP_PREFIX)
        assert info["filename"].endswith(".zip")
        assert info["size"] > 0
        assert os.path.isfile(info["path"])

        with zipfile.ZipFile(info["path"]) as zf:
            names = set(zf.namelist())
        assert "kabayan.db" in names
        assert "uploads/materi.pdf" in names

    def test_db_snapshot_is_readable_and_consistent(self, seeded_fs):
        db_path = str(seeded_fs["storage"] / "kabayan.db")
        _write_db(db_path, rows=5)
        info = create_backup()
        with zipfile.ZipFile(info["path"]) as zf:
            zf.extract("kabayan.db", str(seeded_fs["storage"] / "extract"))
        conn = sqlite3.connect(str(seeded_fs["storage"] / "extract" / "kabayan.db"))
        rows = conn.execute("SELECT COUNT(*) FROM subjects").fetchone()[0]
        conn.close()
        assert rows == 5

    def test_backup_without_db_still_contains_files(self, seeded_fs):
        info = create_backup()
        with zipfile.ZipFile(info["path"]) as zf:
            names = set(zf.namelist())
        assert "kabayan.db" not in names
        assert "uploads/materi.pdf" in names

    def test_excludes_trash_and_backups_dir(self, seeded_fs):
        _write_db(str(seeded_fs["storage"] / "kabayan.db"))
        (seeded_fs["storage"] / "trash").mkdir(parents=True, exist_ok=True)
        (seeded_fs["storage"] / "trash" / "sampah.pdf").write_bytes(b"x")
        info = create_backup()
        with zipfile.ZipFile(info["path"]) as zf:
            names = set(zf.namelist())
        assert not any("trash" in n for n in names)
        assert not any("backups" in n for n in names)


class TestCleanup:
    def test_keeps_only_five_latest(self, seeded_fs, monkeypatch):
        _write_db(str(seeded_fs["storage"] / "kabayan.db"))
        import time
        for _ in range(7):
            info = create_backup(cleanup_older=True)
            time.sleep(0.01)
        backups = list_backups()
        assert len(backups) == 5
        assert info["filename"] == backups[0]["filename"]


class TestListAndDownload:
    def test_list_orders_newest_first(self, seeded_fs):
        _write_db(str(seeded_fs["storage"] / "kabayan.db"))
        create_backup()
        backups = list_backups()
        assert len(backups) == 1
        assert backups[0]["size"] > 0

    def test_backup_path_for_sanitizes(self, seeded_fs):
        _write_db(str(seeded_fs["storage"] / "kabayan.db"))
        info = create_backup()
        assert backup_path_for(info["filename"]) == info["path"]
        assert backup_path_for("../../etc/passwd") is None
        assert backup_path_for("not-a-backup.zip") is None

    def test_download_endpoint_streams_zip(self, seeded_fs, client):
        _write_db(str(seeded_fs["storage"] / "kabayan.db"))
        info = create_backup()
        res = client.get(f"/api/backup/download?filename={info['filename']}")
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/zip"
        assert len(res.content) == info["size"]

    def test_download_rejects_traversal(self, seeded_fs, client):
        res = client.get("/api/backup/download?filename=../../storage/kabayan.db")
        assert res.status_code == 404

    def test_create_endpoint_returns_metadata(self, seeded_fs, client):
        _write_db(str(seeded_fs["storage"] / "kabayan.db"))
        res = client.post("/api/backup/create")
        assert res.status_code == 200
        data = res.json()
        assert "filename" in data and "size" in data and "files" in data