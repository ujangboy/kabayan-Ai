"""Sampah (recycle bin) — soft-delete materi agar bisa di-restore.

Saat materi dihapus, record `Material` tidak dihapus permanen melainkan
ditandai status "Trashed". File fisik (+ audio) dipindah ke storage/trash
dengan nama unik, dan pemetaan path asli <-> path trash dicatat di tabel
`TrashItem`. Dari sampah user bisa: restore (kembalikan file & status) atau
hapus permanen (file + record). File yatim (orphan) juga dicatat agar tampil.
"""
import os
import uuid
import logging
import datetime

from sqlalchemy.orm import Session
from models import TrashItem, Material
from services.cache_service import cache_service
from services.rag_service import rag_service

logger = logging.getLogger(__name__)


def _move_to_trash_dir(filepath: str) -> str | None:
    """Pindahkan satu file ke storage/trash dengan nama unik. Return path trash atau None."""
    import config
    if not filepath or not os.path.isfile(filepath):
        return None
    try:
        os.makedirs(config.TRASH_DIR, exist_ok=True)
        name = os.path.basename(filepath)
        stem, ext = os.path.splitext(name)
        dest = os.path.join(config.TRASH_DIR, f"{stem}_{uuid.uuid4().hex[:8]}{ext}")
        os.rename(filepath, dest)
        return dest
    except Exception as exc:
        logger.warning("[Trash] Gagal pindahkan ke trash %s: %r", filepath, exc)
        return None


def trash_file_with_meta(db: Session, filepath: str, source_type: str = "material",
                         material_id: int | None = None, original_filename: str | None = None,
                         original_status: str | None = None) -> bool:
    """Pindahkan file ke trash + catat TrashItem untuk restore. Tidak commit."""
    if not filepath or not os.path.exists(filepath):
        return False
    dest = _move_to_trash_dir(filepath)
    if not dest:
        return False
    size = 0
    try:
        size = os.path.getsize(dest)
    except OSError:
        pass
    db.add(TrashItem(
        material_id=material_id,
        source_type=source_type,
        original_path=filepath,
        trash_path=dest,
        original_filename=original_filename or os.path.basename(filepath),
        original_status=original_status,
        size_bytes=size,
        trashed_at=datetime.datetime.utcnow(),
    ))
    return True


# ─── Materi (soft-delete) ──────────────────────────────────────────────────

def trash_material(db: Session, material_id: int) -> bool:
    """Soft-delete materi: pindah file + audio ke trash, tandai status Trashed."""
    mat = db.query(Material).filter(Material.id == material_id).first()
    if not mat:
        return False

    original_status = mat.status
    filepath = getattr(mat, "filepath", None)

    # File fisik materi utama -> trash (jika ada & bukan online/youtube semata)
    if filepath:
        trash_file_with_meta(db, filepath, "material", material_id, mat.filename, original_status)

    # Audio milik materi -> trash
    from models import AudioGeneration
    audio_rows = db.query(AudioGeneration).filter(AudioGeneration.material_id == material_id).all()
    for row in audio_rows:
        if row.filepath:
            full = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", row.filepath.lstrip("/"))
            full = os.path.normpath(full)
            if os.path.isfile(full):
                trash_file_with_meta(db, full, "audio", material_id, os.path.basename(full))

    # Cegah cleanup_orphan_files memindah file yang sudah di-trash ke tmp naming conflict
    mat.status = "Trashed"
    mat.filepath = None
    db.commit()
    cache_service.invalidate_all(db)
    return True


def _recover_original_name(trash_name: str) -> str:
    """Best-effort pulihkan nama asli file trash ber-suffix uuid (stem_8hex.ext)."""
    import re
    stem, ext = os.path.splitext(trash_name)
    m = re.match(r"^(.*)_[0-9a-f]{8}$", stem)
    if m:
        return m.group(1) + ext
    return trash_name


def _register_orphan_files(db: Session) -> None:
    """Daftarkan file di TRASH_DIR yang belum punya TrashItem sebagai orphan.

    File yang masuk trash sebelum fitur sampah (dipindah oleh trash_file lama
    tanpa metadata) tetap tampil & bisa dihapus permanen / dikosongkan.
    """
    import config
    known = {os.path.basename(it.trash_path) for it in db.query(TrashItem).all() if it.trash_path}
    if not os.path.isdir(config.TRASH_DIR):
        return
    changed = False
    for name in os.listdir(config.TRASH_DIR):
        full = os.path.join(config.TRASH_DIR, name)
        if not os.path.isfile(full) or name in known:
            continue
        original = _recover_original_name(name)
        original_path = os.path.join(config.UPLOADS_DIR, original)
        size = 0
        try:
            size = os.path.getsize(full)
        except OSError:
            pass
        db.add(TrashItem(
            material_id=None,
            source_type="orphan",
            original_path=original_path,
            trash_path=full,
            original_filename=original,
            original_status=None,
            size_bytes=size,
            trashed_at=datetime.datetime.utcnow(),
        ))
        known.add(name)
        changed = True
    if changed:
        db.commit()


def list_trash(db: Session) -> list[dict]:
    """Daftar item sampah dengan info ringkas untuk UI."""
    _register_orphan_files(db)
    items = db.query(TrashItem).order_by(TrashItem.trashed_at.desc()).all()
    result = []
    for it in items:
        result.append({
            "id": it.id,
            "material_id": it.material_id,
            "source_type": it.source_type,
            "original_filename": it.original_filename,
            "original_status": it.original_status,
            "size_bytes": it.size_bytes,
            "trashed_at": it.trashed_at.isoformat() if it.trashed_at else None,
            "file_exists": os.path.isfile(it.trash_path) if it.trash_path else False,
        })
    return result


def restore_material(db: Session, material_id: int) -> bool:
    """Kembalikan materi dari sampah: balikan file + status, hapus TrashItem."""
    mat = db.query(Material).filter(Material.id == material_id).first()
    if not mat:
        return False
    return _restore_for_material(db, mat)


def _restore_for_material(db: Session, mat: Material) -> bool:
    restored_status = None
    restored_filepath = None
    items = db.query(TrashItem).filter(TrashItem.material_id == mat.id).all()
    for it in items:
        # Balikan file fisik trash -> lokasi asli
        if it.trash_path and os.path.isfile(it.trash_path):
            try:
                os.makedirs(os.path.dirname(it.original_path), exist_ok=True)
                os.rename(it.trash_path, it.original_path)
            except Exception as e:
                logger.warning("Gagal restore file %s: %r", it.trash_path, e)
                db.rollback()
                return False
        if it.source_type == "material":
            restored_status = it.original_status
            restored_filepath = it.original_path
        db.delete(it)
    db.flush()

    # Pulihkan status & filepath asli materi (fallback Ready bila tanpa metadata)
    status = restored_status or "Ready"
    if status == "Trashed":
        status = "Ready"
    mat.status = status
    if restored_filepath:
        mat.filepath = restored_filepath
    db.commit()
    cache_service.invalidate_all(db)
    return True


def delete_material_permanent(db: Session, material_id: int) -> bool:
    """Hapus permanen materi dari sampah: file trunk + audio + record + RAG chunks."""
    mat = db.query(Material).filter(Material.id == material_id).first()
    if not mat:
        return False

    # Hapus RAG chunks + rebuild
    from services.rag_service import rag_service
    doc_id = f"mat_{mat.id}"
    rag_service.delete_document_chunks(doc_id)
    if rag_service._should_rebuild():
        import threading
        threading.Thread(target=rag_service.rebuild_index, daemon=True).start()

    # Hapus file fisik di trash (termasuk audio) + row TrashItem
    items = db.query(TrashItem).filter(TrashItem.material_id == material_id).all()
    for it in items:
        if it.trash_path:
            try:
                os.remove(it.trash_path)
            except OSError:
                pass
        db.delete(it)
    db.flush()

    # Hapus audio records + materi record (cascade)
    from models import AudioGeneration
    db.query(AudioGeneration).filter(AudioGeneration.material_id == material_id).delete(synchronize_session=False)
    db.delete(mat)
    db.commit()
    cache_service.invalidate_all(db)
    return True


def delete_item_permanent(db: Session, item_id: int) -> bool:
    """Hapus permanen satu TrashItem (file trunk + row). Non-materi (orphan)."""
    it = db.query(TrashItem).filter(TrashItem.id == item_id).first()
    if not it:
        return False
    if it.material_id:
        # Row milik materi: delegasikan ke penghapusan menyeluruh materi
        # (file + audio + record + RAG) agar tak meninggalkan materi sampah nyangkut.
        return delete_material_permanent(db, it.material_id)
    if it.trash_path:
        try:
            os.remove(it.trash_path)
        except OSError:
            pass
    db.delete(it)
    db.commit()
    return True


def restore_item(db: Session, item_id: int) -> bool:
    """Restore satu TrashItem non-materi (orphan) ke path aslinya."""
    it = db.query(TrashItem).filter(TrashItem.id == item_id).first()
    if not it:
        return False
    if it.trash_path and os.path.isfile(it.trash_path):
        try:
            os.makedirs(os.path.dirname(it.original_path), exist_ok=True)
            os.rename(it.trash_path, it.original_path)
        except Exception as e:
            logger.warning("Gagal restore orphan %s: %r", it.trash_path, e)
            db.rollback()
            return False
    db.delete(it)
    db.commit()
    return True


def empty_trash(db: Session) -> int:
    """Kosongkan sampah permanen.

    Semua file trunk + row TrashItem dihapus. Record materi yang ditandai
    Trashed ikut dihapus permanen (file + audio + record + RAG chunks) supaya
    tidak tersisa materi zombie tanpa TrashItem yang tak bisa di-restore.
    """
    _register_orphan_files(db)
    items = db.query(TrashItem).all()
    count = 0
    for it in items:
        if it.trash_path:
            try:
                os.remove(it.trash_path)
            except OSError:
                pass
        db.delete(it)
        count += 1

    from models import AudioGeneration
    trashed = db.query(Material).filter(Material.status == "Trashed").all()
    for mat in trashed:
        rag_service.delete_document_chunks(f"mat_{mat.id}")
        db.query(AudioGeneration).filter(AudioGeneration.material_id == mat.id).delete(synchronize_session=False)
        db.delete(mat)
        count += 1

    db.commit()
    if trashed and rag_service._should_rebuild():
        import threading
        threading.Thread(target=rag_service.rebuild_index, daemon=True).start()
    cache_service.invalidate_all(db)
    return count


def get_trash_count(db: Session) -> int:
    """Jumlah item sampah (untuk overview)."""
    _register_orphan_files(db)
    return db.query(TrashItem).count()