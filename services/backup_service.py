"""
Backup Service — ekspor data lokal ke satu arsip ZIP portabel.

Isi backup:
  - kabayan.db      : snapshot SQLite konsisten (API backup, bukan file copy)
                      → seluruh data: materi, flashcards, quiz, ujian, profil.
  - uploads/        : file materi asli (PDF/docx/txt/xlsx/pptx)

Tidak disertakan (regenerable / bukan data pengguna):
  - lancedb/   indeks vektor — dibuat ulang otomatis dari uploads (0 token)
  - text_cache/ cache chunk — regenerable
  - trash/     file yang sudah dihapus (safety-net)
  - backups/   arsip backup lain (hindari backup di dalam backup)
"""
from __future__ import annotations

import datetime
import logging
import os
import sqlite3
import tempfile
import zipfile
from typing import Dict, List, Optional

import config

logger = logging.getLogger(__name__)

BACKUP_PREFIX = "kabayan_backup_"
DEFAULT_DB_NAME = "kabayan.db"


def _snapshot_db_to_zip(zf: zipfile.ZipFile, db_path: str) -> int:
    """Salin DB via SQLite backup API (konsisten walau ada koneksi lain)."""
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    try:
        src = sqlite3.connect(db_path)
        try:
            src.execute("PRAGMA busy_timeout=10000")
            dst = sqlite3.connect(tmp.name)
            try:
                with dst:
                    src.backup(dst)
            finally:
                dst.close()
        finally:
            src.close()
        zf.write(tmp.name, DEFAULT_DB_NAME)
        return 1
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


def _add_dir_to_zip(zf: zipfile.ZipFile, dir_path: str, arc_prefix: str) -> list:
    if not dir_path or not os.path.isdir(dir_path):
        return []
    added = []
    for root, dirs, files in os.walk(dir_path):
        for fname in files:
            fpath = os.path.join(root, fname)
            rel = os.path.relpath(fpath, dir_path)
            arcname = f"{arc_prefix}/{rel}".replace("\\", "/")
            try:
                zf.write(fpath, arcname)
                added.append(arcname)
            except OSError as e:
                logger.warning(f"Backup skip {fpath}: {e}")
    return added


def create_backup(cleanup_older: bool = True) -> Dict:
    """Buat arsip backup baru; kembalikan metadata (filename, size, isi)."""
    os.makedirs(config.BACKUPS_DIR, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:23]
    zip_path = os.path.join(config.BACKUPS_DIR, f"{BACKUP_PREFIX}{ts}.zip")

    db_path = os.path.join(config.STORAGE_DIR, DEFAULT_DB_NAME)
    files = []

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        if os.path.exists(db_path):
            files.append(DEFAULT_DB_NAME)
            _snapshot_db_to_zip(zf, db_path)
        else:
            logger.warning("Backup: kabayan.db tidak ditemukan — arsip tanpa database.")
        files.extend(_add_dir_to_zip(zf, config.UPLOADS_DIR, "uploads"))

    size = os.path.getsize(zip_path)

    if cleanup_older:
        _cleanup_old_backups()

    return {
        "filename": os.path.basename(zip_path),
        "path": zip_path,
        "size": size,
        "created_at": ts,
        "files": files,
    }


def _cleanup_old_backups(keep: int = 5):
    """Hapus backup lama (sisakan `keep` terbaru) agar storage tidak membengkak."""
    try:
        backups = list_backups()
        for info in backups[keep:]:
            try:
                os.remove(info["path"])
                logger.info(f"Backup lama dihapus: {info['filename']}")
            except OSError as e:
                logger.warning(f"Gagal hapus backup lama {info['filename']}: {e}")
    except Exception as e:
        logger.warning(f"cleanup backup lama gagal: {e}")


def list_backups() -> List[Dict]:
    if not os.path.isdir(config.BACKUPS_DIR):
        return []
    out = []
    for fname in sorted(os.listdir(config.BACKUPS_DIR), reverse=True):
        if not fname.startswith(BACKUP_PREFIX) or not fname.endswith(".zip"):
            continue
        fpath = os.path.join(config.BACKUPS_DIR, fname)
        try:
            st = os.stat(fpath)
            out.append({
                "filename": fname,
                "path": fpath,
                "size": st.st_size,
                "created_at": fname[len(BACKUP_PREFIX):].replace(".zip", ""),
            })
        except OSError:
            continue
    return out


def backup_path_for(filename: str) -> Optional[str]:
    """Path aman untuk nama file backup (tolak path traversal)."""
    if not filename:
        return None
    safe = os.path.basename(filename)
    if not safe.startswith(BACKUP_PREFIX) or not safe.endswith(".zip"):
        return None
    fpath = os.path.join(config.BACKUPS_DIR, safe)
    return fpath if os.path.isfile(fpath) else None
