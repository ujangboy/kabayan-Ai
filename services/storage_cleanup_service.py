import os
import logging
import config
from sqlalchemy.orm import Session
from models import AudioGeneration, Material

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


def cleanup_orphan_files(db: Session) -> dict:
    """Hapus file yatim: file upload/audio yang tidak lagi direferensikan oleh DB.

    Referensi:
    - audio_generations.filepath (semua status)
    - materials.filepath KECUALI status 'Failed' (materi gagal → file-nya dihapus)

    Scan: storage/uploads + static/audio. Kembalikan ringkasan hasil.
    """
    referenced = set()
    for (fp,) in db.query(AudioGeneration.filepath).all():
        if fp:
            referenced.add(_basename(fp))
    for (fp,) in db.query(Material.filepath).filter(Material.status != "Failed").all():
        if fp:
            referenced.add(_basename(fp))

    targets = [
        ("uploads", config.UPLOADS_DIR),
        ("audio", os.path.join(config.BASE_DIR, "static", "audio")),
    ]

    removed = []
    freed_bytes = 0
    for label, dir_path in targets:
        for name, full in _scan_dir(dir_path).items():
            if name in referenced:
                continue
            try:
                size = os.path.getsize(full)
                os.remove(full)
                removed.append(full)
                freed_bytes += size
                logger.info(f"[StorageCleanup] Hapus file yatim ({label}): {full} ({size} bytes)")
            except Exception as e:
                logger.warning(f"[StorageCleanup] Gagal hapus {full}: {e}")

    if removed:
        logger.info(f"[StorageCleanup] Selesai: {len(removed)} file yatim dihapus, {freed_bytes / 1024:.1f} KB dibebaskan.")
    else:
        logger.info("[StorageCleanup] Tidak ada file yatim.")
    return {"count": len(removed), "freed_bytes": freed_bytes, "removed": removed}
