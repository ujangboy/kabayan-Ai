from app.time_utils import utcnow
import logging
from app.schemas.common import StatusMessage
from app.schemas.responses import FlashcardList, FlashcardDue, FlashcardReviews, FlashcardStats
from fastapi import APIRouter, Depends, Form, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlalchemy import or_
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, OperationalError
from app.database import get_db
from app.repositories.flashcard_repository import flashcard_repository
from app.services.flashcard_service import flashcard_service
from app.services.material_service import material_service
from app.services.rag_context_service import rag_context_service

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/api/flashcards", response_model=FlashcardList)
async def get_flashcards_json(db: Session = Depends(get_db), skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200)):
    from app.models import Material
    flashcards = flashcard_repository.get_all(db, skip=skip, limit=limit)

    # Pre-load all material names
    all_mat_ids: set = set()
    for f in flashcards:
        if f.material_ids:
            for mid in f.material_ids.split(","):
                if mid.strip().isdigit():
                    all_mat_ids.add(int(mid.strip()))
    mat_name_map = {}
    if all_mat_ids:
        mats = db.query(Material).filter(Material.id.in_(all_mat_ids), Material.status != "Trashed").all()
        mat_name_map = {m.id: m.filename or f"Materi #{m.id}" for m in mats}

    results = []
    for f in flashcards:
        material_names = []
        if f.material_ids:
            for mid in f.material_ids.split(","):
                if mid.strip().isdigit():
                    name = mat_name_map.get(int(mid.strip()))
                    if name:
                        material_names.append(name)
        results.append({
            "id": f.id,
            "question": f.question,
            "answer": f.answer,
            "created_at": f.created_at.isoformat() if f.created_at else None,
            "subject": {"id": f.subject.id, "name": f.subject.name} if f.subject else None,
            "material_names": material_names,
            "title": f.title,
            "batch_id": f.batch_id,
            # ─── SRS fields ───
            "next_review": f.next_review.isoformat() if f.next_review else None,
            "interval_days": f.interval,
            "ease_factor": (f.ease_factor or 250) / 100,
            "times_seen": f.times_seen or 0,
            "times_correct": f.times_correct or 0,
            "last_reviewed": f.last_reviewed.isoformat() if f.last_reviewed else None,
            "mastered": f.mastered or 0,
        })
    return JSONResponse({"flashcards": results, "skip": skip, "limit": limit})


class ReviewRequest(BaseModel):
    flashcard_id: int
    # 0=Lupa, 1=Sulit, 2=Biasa, 3=Mudah, 4=Sempurna — di luar rentang ini
    # FSRS sebelumnya diam-diam memetakannya ke "Good" dan mengotori statistik.
    rating: int = Field(..., ge=0, le=4)
    response_time_ms: Optional[int] = Field(default=None, ge=0)


@router.post("/api/flashcards/review", response_model=dict)
async def review_flashcard(req: ReviewRequest, db: Session = Depends(get_db)):
    """Catat penilaian user untuk satu kartu dan update jadwal SRS."""
    from app.models import Flashcard
    flashcard = db.query(Flashcard).filter(Flashcard.id == req.flashcard_id).first()
    if not flashcard:
        return JSONResponse(status_code=404, content={"detail": "Flashcard tidak ditemukan."})
    result = flashcard_service.apply_review(db, flashcard, req.rating, req.response_time_ms)
    db.commit()
    return JSONResponse({"status": "success", "flashcard_id": req.flashcard_id, **result})


@router.get("/api/flashcards/review/due", response_model=FlashcardDue)
async def get_due_flashcards(subject_id: int = Query(None), db: Session = Depends(get_db), limit: int = Query(50, ge=1, le=200)):
    """Kartu yang siap direview: kartu baru (belum pernah direview) + kartu yang sudah jatuh tempo."""
    import datetime
    from app.models import Flashcard
    now = utcnow()
    query = db.query(Flashcard).filter(
        Flashcard.mastered == 0,
        or_(
            Flashcard.times_seen == 0,          # kartu baru: belum pernah direview
            Flashcard.next_review.is_(None),    # belum pernah dijadwalkan (manual/legacy)
            Flashcard.next_review <= now,       # sudah waktunya review
        )
    )
    if subject_id:
        query = query.filter(Flashcard.subject_id == subject_id)
    cards = query.order_by(Flashcard.next_review.asc()).limit(limit).all()

    results = []
    for f in cards:
        results.append({
            "id": f.id,
            "question": f.question,
            "answer": f.answer,
            "subject_id": f.subject_id,
            "subject_name": f.subject.name if f.subject else None,
            "next_review": f.next_review.isoformat() if f.next_review else None,
            "interval_days": f.interval,
            "times_seen": f.times_seen or 0,
            "mastered": f.mastered or 0,
        })
    return JSONResponse({"due_count": len(results), "flashcards": results})


@router.get("/api/flashcards/reviews", response_model=FlashcardReviews)
async def get_flashcard_reviews(card_ids: str = Query(..., description="Comma-separated flashcard IDs"), db: Session = Depends(get_db)):
    """Riwayat review per kartu (log Lupa/Ingat/Hafal + jadwal next_review)."""
    from app.models import FlashcardReview
    ids: list[int] = []
    for part in card_ids.split(","):
        part = part.strip()
        if part.isdigit():
            ids.append(int(part))
    if not ids:
        return JSONResponse({"reviews": {}})

    reviews = (
        db.query(FlashcardReview)
        .filter(FlashcardReview.flashcard_id.in_(ids))
        .order_by(FlashcardReview.flashcard_id.asc(), FlashcardReview.reviewed_at.asc())
        .all()
    )

    grouped: dict[int, list[dict]] = {}
    for r in reviews:
        grouped.setdefault(r.flashcard_id, []).append({
            "id": r.id,
            "rating": r.rating,
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
            "next_review": r.next_review.isoformat() if r.next_review else None,
            "response_time_ms": r.response_time_ms,
        })
    return JSONResponse({"reviews": grouped})


@router.get("/api/flashcards/stats", response_model=FlashcardStats)
async def get_flashcard_stats(subject_id: int = Query(None), db: Session = Depends(get_db)):
    """Statistik flashcard: total, mastered, perlu review, dll."""
    import datetime
    from app.models import Flashcard
    query = db.query(Flashcard)
    if subject_id:
        query = query.filter(Flashcard.subject_id == subject_id)
    cards = query.all()

    now = utcnow()
    total = len(cards)
    mastered = sum(1 for c in cards if c.mastered)
    due = sum(1 for c in cards if c.next_review and c.next_review <= now and not c.mastered)
    new_count = sum(1 for c in cards if (c.times_seen or 0) == 0)
    learning = total - mastered - new_count
    avg_ease = round(sum(c.ease_factor or 250 for c in cards) / max(1, total) / 100, 2)

    return JSONResponse({
        "total": total,
        "mastered": mastered,
        "learning": max(0, learning),
        "new": new_count,
        "due_today": due,
        "avg_ease": avg_ease,
    })

@router.post("/api/flashcards", response_model=StatusMessage)
async def create_flashcard(
    question: str = Form(..., max_length=2000),
    answer: str = Form(..., max_length=4000),
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

@router.post("/api/flashcards/batch-delete", response_model=StatusMessage)
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
        from app.services.error_handler import safe_json_response
        return safe_json_response(e, context="flashcards/batch-delete")

@router.post("/api/flashcards/{flashcard_id}/delete", response_model=StatusMessage)
async def delete_flashcard(flashcard_id: int, db: Session = Depends(get_db)):
    try:
        found = flashcard_repository.delete(db, flashcard_id)
        if not found:
            return JSONResponse(status_code=404, content={"detail": f"Flashcard #{flashcard_id} tidak ditemukan atau sudah dihapus."})
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
        from app.services.error_handler import safe_json_response
        return safe_json_response(e, context="flashcards/delete")

@router.post("/api/flashcards/clear", response_model=StatusMessage)
async def clear_flashcards(db: Session = Depends(get_db)):
    flashcard_repository.delete_all(db)
    return JSONResponse({"status": "success", "message": "Flashcards cleared"})


from app.schemas.generate import GenerateFlashcardRequest


def _derive_deck_title(materials):
    """Derive judul deck dari nama file materi (mis. 'PERT 11_ALGORITMA' -> 'Pertemuan 11 — Algoritma')."""
    import re
    names = [m.filename or '' for m in materials if m.filename]
    base = names[0] if names else 'Flashcard'
    stem = base.rsplit('.', 1)[0]
    stem = stem.replace('_', ' ').replace('-', ' ').replace('.', ' ')
    m = re.search(r'(pertemuan|modul|bab|pert|pt)\s*[:#]?\s*(\d+)', stem, re.IGNORECASE)
    if m:
        kind = 'Pertemuan' if m.group(1).lower().startswith('pert') else m.group(1).capitalize()
        num = m.group(2)
        rest = re.sub(r'(pertemuan|modul|bab|pert|pt)\s*[:#]?\s*\d+', '', stem, flags=re.IGNORECASE)
        rest = re.sub(r'\s+', ' ', rest).strip(' —-')
        return f"{kind} {num}{(' — ' + rest) if rest else ''}"
    return re.sub(r'\s+', ' ', stem).strip() or base

@router.post("/api/flashcards/generate", response_model=dict)
async def generate_flashcards(
    req: GenerateFlashcardRequest,
    db: Session = Depends(get_db)
):
    """Generate flashcards dari materi subject menggunakan AI + RAG."""
    try:
        # Gunakan shared utility untuk mendapatkan materi Ready
        materials = material_service.get_ready_materials(db, req.subject_id, req.material_ids)
        if not materials:
            all_materials = material_service.get_by_subject(db, req.subject_id)
            if req.material_ids:
                ids = [int(x.strip()) for x in req.material_ids.split(",") if x.strip()]
                if ids:
                    all_materials = [m for m in all_materials if m.id in ids]
            if not all_materials:
                return JSONResponse(status_code=400, content={"detail": "Tidak ada materi untuk mata kuliah ini."})
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
            count=req.count,
            title=_derive_deck_title(materials),
            material_ids=req.material_ids or None,
            batch_id=req.batch_id or None,
            difficulty=req.difficulty or "sedang",
        )
        return JSONResponse({
            "status": "success",
            "count": data["count"],
            "batch_id": data["batch_id"],
            "message": f"{data['count']} flashcard berhasil dibuat oleh AI."
        })
    except ValueError as e:
        # Kegagalan parsing output AI = error server-side (bukan 422 client),
        # dan snippet output AI tidak boleh dikirim ke client.
        logger.error(f"Generate flashcards error: {e}")
        return JSONResponse(status_code=502, content={"detail": "AI gagal menghasilkan flashcard yang valid. Silakan coba lagi."})
    except Exception as e:
        from app.services.error_handler import safe_json_response
        return safe_json_response(e, context="flashcards/generate")
