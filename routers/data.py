"""Overview data aplikasi untuk halaman Pengaturan > Data.

Menghimpun jumlah item per kategori + penggunaan penyimpanan. Frontend lalu
memuat detail per kategori via endpoint khusus masing-masing (materials, chats,
flashcards, quizzes, notes, exam sessions). Menyediakan juga backup/export ZIP.
"""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session

from database import get_db
import models
import os
from services.storage_cleanup_service import get_storage_usage
from services.usage_service import get_usage
from services.trash_service import get_trash_count
from services.backup_service import create_backup, list_backups, backup_path_for
from exceptions import AppError

router = APIRouter()


@router.get("/api/usage")
async def usage_summary(db: Session = Depends(get_db)):
    """Pemakaian Groq API per fitur + total (token estimasi & jumlah panggilan)."""
    try:
        return JSONResponse(get_usage(db))
    except AppError:
        raise
    except Exception as exc:
        raise AppError(str(exc), status_code=500)


@router.get("/api/data/overview")
async def data_overview(db: Session = Depends(get_db)):
    """Ringkasan jumlah data per kategori + total penyimpanan."""
    try:
        storage = get_storage_usage()

        stats = {
            "subjects": db.query(models.Subject).count(),
            "materials": db.query(models.Material)
                .filter(models.Material.status != "Trashed").count(),
            "materials_ready": db.query(models.Material)
                .filter(models.Material.status == "Ready").count(),
            "materials_pending": db.query(models.Material)
                .filter(models.Material.status.in_(["Pending", "Processing"])).count(),
            "materials_failed": db.query(models.Material)
                .filter(models.Material.status == "Failed").count(),
            "materials_trashed": db.query(models.Material)
                .filter(models.Material.status == "Trashed").count(),
            "trash_items": get_trash_count(db),
            "chats": db.query(models.Chat).count(),
            "messages": db.query(models.Message).count(),
            "notes": db.query(models.Note).count(),
            "flashcards": db.query(models.Flashcard).count(),
            "quizzes": db.query(models.Quiz).count(),
            "exam_sessions": db.query(models.ExamSession).count(),
            "exam_blueprints": db.query(models.ExamBlueprint).count(),
            "question_bank": db.query(models.QuestionBank).count(),
        }

        return JSONResponse({
            "stats": stats,
            "storage": storage,
        })
    except AppError:
        raise
    except Exception as exc:
        raise AppError(str(exc), status_code=500)


# ─── Backup / Export ─────────────────────────────────────────────────────────

@router.post("/api/backup/create")
async def create_backup_now():
    """Buat arsip backup ZIP (DB snapshot + uploads) di storage/backups."""
    try:
        return JSONResponse(create_backup())
    except AppError:
        raise
    except Exception as exc:
        raise AppError(str(exc), status_code=500)


@router.get("/api/backup/list")
async def list_backup_archives():
    """Daftar arsip backup yang tersedia (terbaru dulu)."""
    try:
        return JSONResponse({"backups": list_backups()})
    except AppError:
        raise
    except Exception as exc:
        raise AppError(str(exc), status_code=500)


@router.get("/api/backup/download")
async def download_backup_archive(filename: str = Query(...)):
    """Unduh arsip backup; nama file disanitasi (tolak path traversal)."""
    path = backup_path_for(filename)
    if not path:
        return JSONResponse(status_code=404, content={"detail": "Backup tidak ditemukan."})
    return FileResponse(
        path,
        media_type="application/zip",
        filename=os.path.basename(path),
    )