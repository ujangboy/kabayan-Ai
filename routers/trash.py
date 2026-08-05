"""Sampah (recycle bin) — list, restore, hapus permanen, kosongkan.

Materi yang dihapus tidak langsung musnah: file fisik (+ audio) dipindah ke
storage/trash dan record Materi ditandai status "Trashed" sehingga bisa
di-restore dari halaman Pengaturan > Data.
"""
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import get_db
from services.trash_service import (
    list_trash,
    restore_material,
    restore_item,
    delete_material_permanent,
    delete_item_permanent,
    empty_trash,
)
from exceptions import AppError

router = APIRouter()


@router.get("/api/trash")
async def trash_list(db: Session = Depends(get_db)):
    """Daftar semua item sampah."""
    try:
        return JSONResponse({"items": list_trash(db)})
    except AppError:
        raise
    except Exception as exc:
        raise AppError(str(exc), status_code=500)


@router.post("/api/trash/{item_id}/restore")
async def trash_restore(item_id: int, db: Session = Depends(get_db)):
    """Kembalikan satu item sampah ke posisi semula."""
    try:
        ok = restore_item(db, item_id)
        if not ok:
            raise AppError("Item sampah tidak ditemukan.", status_code=404)
        return JSONResponse({"status": "success", "message": "Item dipulihkan."})
    except AppError:
        raise
    except Exception as exc:
        raise AppError(str(exc), status_code=500)


@router.post("/api/trash/{item_id}/delete")
async def trash_delete(item_id: int, db: Session = Depends(get_db)):
    """Hapus permanen satu item sampah (file + record)."""
    try:
        ok = delete_item_permanent(db, item_id)
        if not ok:
            raise AppError("Item sampah tidak ditemukan.", status_code=404)
        return JSONResponse({"status": "success", "message": "Item dihapus permanen."})
    except AppError:
        raise
    except Exception as exc:
        raise AppError(str(exc), status_code=500)


@router.post("/api/trash/materials/{material_id}/restore")
async def trash_restore_material(material_id: int, db: Session = Depends(get_db)):
    """Kembalikan materi (beserta audio) dari sampah."""
    try:
        ok = restore_material(db, material_id)
        if not ok:
            raise AppError("Materi sampah tidak ditemukan.", status_code=404)
        return JSONResponse({"status": "success", "message": "Materi dipulihkan."})
    except AppError:
        raise
    except Exception as exc:
        raise AppError(str(exc), status_code=500)


@router.post("/api/trash/materials/{material_id}/delete")
async def trash_delete_material(material_id: int, db: Session = Depends(get_db)):
    """Hapus permanen materi (file + audio + record + RAG chunks)."""
    try:
        ok = delete_material_permanent(db, material_id)
        if not ok:
            raise AppError("Materi sampah tidak ditemukan.", status_code=404)
        return JSONResponse({"status": "success", "message": "Materi dihapus permanen."})
    except AppError:
        raise
    except Exception as exc:
        raise AppError(str(exc), status_code=500)


@router.post("/api/trash/empty")
async def trash_empty(db: Session = Depends(get_db)):
    """Kosongkan sampah permanen (semua file di trash dir dihapus)."""
    try:
        count = empty_trash(db)
        return JSONResponse({"status": "success", "count": count, "message": "Sampah dikosongkan."})
    except AppError:
        raise
    except Exception as exc:
        raise AppError(str(exc), status_code=500)