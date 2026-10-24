import os
import time
import uuid
import tempfile
import logging
from app import config
from sqlalchemy.orm import Session
from app.models import Material

logger = logging.getLogger(__name__)


def _scan_dir(dir_path: str) -> dict:
    """Kembalikan {nama_file: path_lengkap} untuk file di satu direktori."""
    files = {}
    if not os.path.isdir(dir_path):
        return files
    for name in os.listdir(dir_path):
        full = os.path.join(dir_path, name)
        if os.path.isfile(full):
            files[name] = full
    return files


def _basename(fp: str) -> str:
    """Ambil nama file dari path DB (bisa berawalan '/' atau path absolut)."""
    return os.path.basename(fp.replace("\\", "/"))


# ─── D2: Safety-net trash ───────────────────────────────────────────────────

def trash_file(filepath: str) -> bool:
    """Pindahkan file ke storage/trash (safety-net) alih-alih hapus permanen.

    Nama diberi suffix unik agar tidak bertabrakan. File di trash dibersihkan
    oleh cleanup_trash() setelah melewati masa retensi.
    """
    if not filepath or not os.path.exists(filepath):
        return False
    try:
        os.makedirs(config.TRASH_DIR, exist_ok=True)
        name = os.path.basename(filepath)
        stem, ext = os.path.splitext(name)
        dest = os.path.join(config.TRASH_DIR, f"{stem}_{uuid.uuid4().hex[:8]}{ext}")
        os.rename(filepath, dest)
        logger.info(f"[StorageCleanup] File dipindah ke trash: {filepath} -> {dest}")
        return True
    except Exception as e:
        logger.warning(f"[StorageCleanup] Gagal pindahkan ke trash {filepath}: {e}")
        return False


def cleanup_trash(max_age_days: int = None) -> dict:
    """Hapus permanen file di trash yang lebih tua dari masa retensi (default config)."""
    if max_age_days is None:
        max_age_days = config.TRASH_RETENTION_DAYS
    if not os.path.isdir(config.TRASH_DIR):
        return {"count": 0, "freed_bytes": 0, "removed": []}
    cutoff = time.time() - max_age_days * 86400
    removed = []
    freed_bytes = 0
    for name in os.listdir(config.TRASH_DIR):
        full = os.path.join(config.TRASH_DIR, name)
        if not os.path.isfile(full):
            continue
        try:
            if os.path.getmtime(full) < cutoff:
                size = os.path.getsize(full)
                os.remove(full)
                removed.append(full)
                freed_bytes += size
                logger.info(f"[StorageCleanup] Trash dihapus permanen: {full} ({size} bytes)")
        except Exception as e:
            logger.warning(f"[StorageCleanup] Gagal hapus trash {full}: {e}")
    if removed:
        logger.info(f"[StorageCleanup] Trash dibersihkan: {len(removed)} file, {freed_bytes / 1024:.1f} KB.")
    return {"count": len(removed), "freed_bytes": freed_bytes, "removed": removed}


# ─── D3: yt-dlp temp sweep ─────────────────────────────────────────────────

def cleanup_ytdlp_temp(max_age_hours: int = 24) -> dict:
    """Bersihkan file temp yt-dlp (kabayan_sub_*/kabayan_yt_*) yang menggantung.

    Cleanup normal di youtube_source.py sudah berjalan, tapi saat proses mati
    (crash/kill) file .vtt/.part bisa tertinggal di temp dir.
    """
    tmp = tempfile.gettempdir()
    cutoff = time.time() - max_age_hours * 3600
    removed = []
    freed_bytes = 0
    try:
        entries = os.listdir(tmp)
    except OSError:
        return {"count": 0, "freed_bytes": 0, "removed": []}
    for name in entries:
        if not (name.startswith("kabayan_sub_") or name.startswith("kabayan_yt_")):
            continue
        full = os.path.join(tmp, name)
        if not os.path.isfile(full):
            continue
        try:
            if os.path.getmtime(full) < cutoff:
                size = os.path.getsize(full)
                os.remove(full)
                removed.append(full)
                freed_bytes += size
                logger.info(f"[StorageCleanup] Temp yt-dlp dihapus: {full} ({size} bytes)")
        except Exception as e:
            logger.warning(f"[StorageCleanup] Gagal hapus temp yt-dlp {full}: {e}")
    if removed:
        logger.info(f"[StorageCleanup] Temp yt-dlp dibersihkan: {len(removed)} file, {freed_bytes / 1024:.1f} KB.")
    return {"count": len(removed), "freed_bytes": freed_bytes, "removed": removed}


# ─── Orphan sweep ──────────────────────────────────────────────────────────

def cleanup_orphan_files(db: Session) -> dict:
    """Bersihkan file yatim: file upload yang tidak lagi direferensikan DB.

    Referensi:
    - materials.filepath KECUALI status 'Failed' (materi gagal → file-nya dihapus)

    File yatim DIPINDAHKAN ke trash (safety-net D2), bukan langsung dihapus permanen.
    Scan: storage/uploads. Kembalikan ringkasan hasil.
    """
    referenced = set()
    for (fp,) in db.query(Material.filepath).filter(Material.status != "Failed").all():
        if fp:
            referenced.add(_basename(fp))

    targets = [
        ("uploads", config.UPLOADS_DIR),
    ]

    removed = []
    freed_bytes = 0
    for label, dir_path in targets:
        for name, full in _scan_dir(dir_path).items():
            if name in referenced:
                continue
            try:
                size = os.path.getsize(full)
                if trash_file(full):
                    removed.append(full)
                    freed_bytes += size
                    logger.info(f"[StorageCleanup] File yatim ({label}) -> trash: {full} ({size} bytes)")
            except Exception as e:
                logger.warning(f"[StorageCleanup] Gagal bersihkan file yatim {full}: {e}")

    if removed:
        logger.info(f"[StorageCleanup] Selesai: {len(removed)} file yatim dipindah ke trash, {freed_bytes / 1024:.1f} KB dibebaskan.")
    else:
        logger.info("[StorageCleanup] Tidak ada file yatim.")
    return {"count": len(removed), "freed_bytes": freed_bytes, "removed": removed}


# ─── D6: storage usage ─────────────────────────────────────────────────────

def get_storage_usage() -> dict:
    """Ukuran total storage yang sedang dipakai (uploads + trash)."""
    dirs = {
        "uploads": config.UPLOADS_DIR,
        "trash": config.TRASH_DIR,
    }
    result = {}
    total = 0
    for label, dir_path in dirs.items():
        size = 0
        if os.path.isdir(dir_path):
            for name in os.listdir(dir_path):
                full = os.path.join(dir_path, name)
                if os.path.isfile(full):
                    try:
                        size += os.path.getsize(full)
                    except OSError:
                        pass
        result[label] = size
        total += size
    result["total"] = total
    return result
