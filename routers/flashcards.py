import logging
from fastapi import APIRouter, Depends, Form, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, OperationalError
from database import get_db
from repositories.flashcard_repository import flashcard_repository
from services.flashcard_service import flashcard_service
from services.material_service import material_service
from services.rag_context_service import rag_context_service

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/api/flashcards")
async def get_flashcards_json(db: Session = Depends(get_db), skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200)):
    flashcards = flashcard_repository.get_all(db, skip=skip, limit=limit)
    results = []
    for f in flashcards:
        results.append({
            "id": f.id,
            "question": f.question,
            "answer": f.answer,
            "created_at": f.created_at.isoformat() if f.created_at else None,
            "subject": {"id": f.subject.id, "name": f.subject.name} if f.subject else None
        })
    return JSONResponse({"flashcards": results, "skip": skip, "limit": limit})

@router.post("/api/flashcards")
async def create_flashcard(
    question: str = Form(...),
    answer: str = Form(...),
    subject_id: int = Form(...),
    db: Session = Depends(get_db)
):
    flashcard_repository.create(db, {
        "question": question,
        "answer": answer,
        "subject_id": subject_id
    })
    return JSONResponse({"status": "success", "message": "Flashcard created"})

class BatchDeleteRequest(BaseModel):
    ids: List[int]

@router.post("/api/flashcards/batch-delete")
async def batch_delete_flashcards(req: BatchDeleteRequest, db: Session = Depends(get_db)):
    """Hapus banyak flashcard dalam SATU transaksi — hindari race condition SQLite."""
    try:
        deleted = 0
        for fid in req.ids:
            if flashcard_repository.delete(db, fid):
                deleted += 1
        return JSONResponse({"status": "success", "deleted": deleted, "total": len(req.ids)})
    except Exception as e:
        logger.error(f"Batch delete error: {e}")
        return JSONResponse(status_code=500, content={"detail": str(e)})

@router.post("/api/flashcards/{flashcard_id}/delete")
async def delete_flashcard(flashcard_id: int, db: Session = Depends(get_db)):
    try:
        found = flashcard_repository.delete(db, flashcard_id)
        if not found:
            return JSONResponse(status_code=404, content={"status": "not_found", "message": f"Flashcard #{flashcard_id} tidak ditemukan atau sudah dihapus."})
        return JSONResponse({"status": "success", "message": "Flashcard deleted"})
    except IntegrityError as e:
        try:
            db.rollback()
        except Exception:
            pass
        return JSONResponse(status_code=409, content={"detail": "Flashcard tidak bisa dihapus karena masih terhubung dengan data lain."})
    except OperationalError as e:
        try:
            db.rollback()
        except Exception:
            pass
        logger.warning(f"Delete flashcard {flashcard_id} still locked after retries: {e}")
        return JSONResponse(status_code=503, content={"detail": "Database sibuk, coba lagi nanti."})
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        logger.error(f"Delete flashcard {flashcard_id} error: {e}")
        return JSONResponse(status_code=500, content={"detail": str(e)})

@router.post("/api/flashcards/clear")
async def clear_flashcards(db: Session = Depends(get_db)):
    flashcard_repository.delete_all(db)
    return JSONResponse({"status": "success", "message": "Flashcards cleared"})


from schemas.generate import GenerateFlashcardRequest

@router.post("/api/flashcards/generate")
async def generate_flashcards(
    req: GenerateFlashcardRequest,
    db: Session = Depends(get_db)
):
    """Generate flashcards dari materi subject menggunakan AI + RAG."""
    try:
        # Gunakan hanya materi yang sudah Ready (terindeks di RAG)
        all_materials = material_service.get_by_subject(db, req.subject_id)
        if req.material_ids:
            ids = [int(x.strip()) for x in req.material_ids.split(",") if x.strip()]
            if ids:
                all_materials = [m for m in all_materials if m.id in ids]
        if not all_materials:
            return JSONResponse(status_code=400, content={"detail": "Tidak ada materi untuk mata kuliah ini."})

        materials = [m for m in all_materials if m.status == "Ready"]
        if not materials:
            processing = [m for m in all_materials if m.status == "Processing"]
            if processing:
                return JSONResponse(status_code=400, content={"detail": "Materi masih diproses (Processing). Tunggu beberapa saat lalu coba lagi."})
            return JSONResponse(status_code=400, content={"detail": "Tidak ada materi yang siap. Pastikan upload materi berhasil (status: Ready)."})

        query = None
        if len(materials) == 1:
            query = materials[0].filename
        context = rag_context_service.gather_context(
            materials, max_words=1500, query=query
        )

        if not context.strip():
            return JSONResponse(
                status_code=400,
                content={"detail": "Tidak ada konten materi yang dapat dibaca. Pastikan file PDF dapat diproses."}
            )

        data = flashcard_service.generate_flashcards(
            db, req.subject_id, context,
            count=req.count
        )
        return JSONResponse({
            "status": "success",
            "count": data,
            "message": f"{data} flashcard berhasil dibuat oleh AI."
        })
    except ValueError as e:
        return JSONResponse(status_code=422, content={"detail": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

