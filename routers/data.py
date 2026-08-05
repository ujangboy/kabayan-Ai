"""Overview data aplikasi untuk halaman Pengaturan > Data.

Menghimpun jumlah item per kategori + penggunaan penyimpanan. Frontend lalu
memuat detail per kategori via endpoint khusus masing-masing (materials, chats,
flashcards, quizzes, notes, exam sessions).
"""
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import get_db
import models
from services.storage_cleanup_service import get_storage_usage
from exceptions import AppError

router = APIRouter()


@router.get("/api/data/overview")
async def data_overview(db: Session = Depends(get_db)):
    """Ringkasan jumlah data per kategori + total penyimpanan."""
    try:
        storage = get_storage_usage()

        stats = {
            "subjects": db.query(models.Subject).count(),
            "materials": db.query(models.Material).count(),
            "materials_ready": db.query(models.Material)
                .filter(models.Material.status == "Ready").count(),
            "materials_pending": db.query(models.Material)
                .filter(models.Material.status.in_(["Pending", "Processing"])).count(),
            "materials_failed": db.query(models.Material)
                .filter(models.Material.status == "Failed").count(),
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