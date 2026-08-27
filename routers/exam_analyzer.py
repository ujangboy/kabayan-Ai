import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from services.exam_service import exam_service
from schemas.exam import (
    BlueprintRequest,
    SubmitAnswersRequest,
    RetryRequest,
    StudyPlanRequest,
    SubmitPlanQuizRequest,
    SubmitPlanFlashcardsRequest,
    ExplainRequest,
)
from exceptions import AppError
from schemas.common import StatusMessage

router = APIRouter(prefix="/api/exam", tags=["Exam Analyzer"])

# Strong refs untuk background task fire-and-forget (anti GC mid-run)
_BACKGROUND_TASKS: set = set()
logger = logging.getLogger(__name__)


@router.post("/analyze/{subject_id}", response_model=StatusMessage)
async def analyze_subject(subject_id: int, db: Session = Depends(get_db)):
    try:
        data = exam_service.analyze(db, subject_id)
        return JSONResponse(data)
    except ValueError as e:
        raise AppError(str(e), status_code=400)
    except Exception as e:
        logger.error(f"analyze error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.post("/blueprint", response_model=StatusMessage)
async def generate_blueprint(
    payload: BlueprintRequest,
    db: Session = Depends(get_db),
):
    try:
        data = exam_service.generate_blueprint(
            db=db,
            subject_id=payload.subject_id,
            exam_type=payload.exam_type,
            total_questions=payload.total_questions,
            difficulty=payload.difficulty,
            bloom_level=payload.bloom_level,
            question_type=payload.question_type,
            focus_material=payload.focus_material,
            duration_minutes=payload.duration_minutes,
            analysis_json=payload.analysis_json,
            material_ids=payload.material_ids,
        )
        return JSONResponse(data)
    except ValueError as e:
        raise AppError(str(e), status_code=400)
    except Exception as e:
        logger.error(f"blueprint error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.get("/blueprints/{subject_id}")
async def get_blueprints(subject_id: int, db: Session = Depends(get_db)):
    try:
        data = exam_service.get_blueprints(db, subject_id)
        return JSONResponse({"blueprints": data})
    except Exception as e:
        logger.error(f"get_blueprints error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.post("/generate/{blueprint_id}", response_model=StatusMessage)
async def generate_questions(blueprint_id: int, db: Session = Depends(get_db)):
    try:
        data = exam_service.generate_questions(db, blueprint_id)
        return JSONResponse(data)
    except ValueError as e:
        raise AppError(str(e), status_code=400)
    except Exception as e:
        logger.error(f"generate_questions error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.post("/submit/{session_id}", response_model=StatusMessage)
async def submit_exam(
    session_id: int,
    payload: SubmitAnswersRequest,
    db: Session = Depends(get_db),
):
    try:
        data = exam_service.submit_and_evaluate(db, session_id, payload.answers)
        from services.subject_service import subject_service
        from repositories.exam_repository import exam_session_repository
        session = exam_session_repository.get(db, session_id)
        if session and session.subject_id:
            subject_service.recalculate_subject_stats(db, session.subject_id)
        # Adaptive learning: agregasi hasil ujian ke profil jangka panjang.
        # Dipanggil dari router (bukan exam_service) agar logika protected tidak berubah.
        try:
            from services.learning_profile_service import ingest_session
            ingest_session(db, session_id)
        except Exception as exc:
            logger.warning("Learning profile ingest gagal: %s", exc)

        # Auto-generate flashcard dari soal yang salah (loop adaptif ujian→flashcard).
        # Fire-and-forget di thread terpisah dengan session sendiri agar tidak
        # memblokir respons submit dan tidak bergantung pada session request.
        try:
            import asyncio

            def _gen_flashcards():
                # Akses runtime via modul — ikut patch test ke DB uji
                import database
                from services.flashcard_service import flashcard_service
                session_db = database.SessionLocal()
                try:
                    flashcard_service.generate_from_exam_review(session_db, session_id, max_cards=8)
                    session_db.commit()
                except Exception as exc:
                    session_db.rollback()
                    logger.warning("Auto flashcard dari ujian gagal: %s", exc)
                finally:
                    session_db.close()

            # Strong reference: task tanpa referensi bisa di-GC mid-run
            # (dokumentasi asyncio.create_task). Set modul-level memegang
            # referensi sampai task selesai lalu membuang dirinya sendiri.
            _task = asyncio.create_task(asyncio.to_thread(_gen_flashcards))
            _BACKGROUND_TASKS.add(_task)
            _task.add_done_callback(_BACKGROUND_TASKS.discard)
        except Exception as exc:
            logger.warning("Menjadwalkan auto flashcard gagal: %s", exc)

        return JSONResponse(data)
    except ValueError as e:
        raise AppError(str(e), status_code=400)
    except Exception as e:
        logger.error(f"submit_exam error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.get("/recommendation/{session_id}")
async def get_recommendation(session_id: int, db: Session = Depends(get_db)):
    try:
        data = exam_service.get_recommendation(db, session_id)
        return JSONResponse(data)
    except ValueError as e:
        raise AppError(str(e), status_code=400)
    except Exception as e:
        logger.error(f"get_recommendation error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.post("/explain", response_model=StatusMessage)
async def get_explanation(
    payload: ExplainRequest,
    db: Session = Depends(get_db),
):
    try:
        explanation = exam_service.get_explanation(
            db=db,
            bank_id=payload.bank_id,
            question_text=payload.question,
            correct_answer=payload.correct_answer,
            topic=payload.topic,
        )
        return JSONResponse({"explanation": explanation})
    except Exception as e:
        logger.error(f"get_explanation error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.get("/bank/stats/{subject_id}")
async def bank_stats(subject_id: int, db: Session = Depends(get_db)):
    try:
        data = exam_service.get_bank_stats(db, subject_id)
        return JSONResponse({"stats": data})
    except Exception as e:
        logger.error(f"bank_stats error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.get("/learning-profile/{subject_id}")
async def get_learning_profile(subject_id: int, db: Session = Depends(get_db)):
    """Profil belajar jangka panjang (adaptive) untuk satu mata kuliah.

    Cold start → default aman (estimated_level 0, topics_mastery {}), bukan error.
    Mengembalikan topic_trend — history akurasi per topik per sesi.
    """
    try:
        from services.subject_service import subject_service
        if not subject_service.get_by_id(db, subject_id):
            raise AppError("Mata kuliah tidak ditemukan.", status_code=404)
        from services.learning_profile_service import get_profile_payload
        return JSONResponse(get_profile_payload(db, subject_id))
    except AppError:
        raise
    except Exception as e:
        logger.error(f"learning_profile error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.post("/learning-profile/{subject_id}/reset", response_model=StatusMessage)
async def reset_learning_profile(subject_id: int, db: Session = Depends(get_db)):
    """Reset profil adaptif per mata kuliah ke kondisi kosong (cold start).

    ExamReview & ExamSession TIDAK dihapus — hanya statistik profil yang direset.
    Gunakan /recalculate setelah reset untuk menghitung ulang dari data yang ada.
    """
    try:
        from services.subject_service import subject_service
        if not subject_service.get_by_id(db, subject_id):
            raise AppError("Mata kuliah tidak ditemukan.", status_code=404)
        from services.learning_profile_service import reset_profile
        reset_profile(db, subject_id)
        return JSONResponse({"status": "reset", "subject_id": subject_id})
    except AppError:
        raise
    except Exception as e:
        logger.error(f"reset_learning_profile error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.post("/learning-profile/{subject_id}/recalculate", response_model=StatusMessage)
async def recalculate_learning_profile(subject_id: int, db: Session = Depends(get_db)):
    """Hitung ulang profil adaptif dari seluruh ExamReview yang ada.

    Berguna setelah reset atau jika profil tidak sinkron dengan histori ujian.
    """
    try:
        from services.subject_service import subject_service
        if not subject_service.get_by_id(db, subject_id):
            raise AppError("Mata kuliah tidak ditemukan.", status_code=404)
        from services.learning_profile_service import recalculate_profile, get_profile_payload
        recalculate_profile(db, subject_id)
        return JSONResponse(get_profile_payload(db, subject_id))
    except AppError:
        raise
    except Exception as e:
        logger.error(f"recalculate_learning_profile error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.get("/sessions")
async def list_unified_sessions(
    subject_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    try:
        data = exam_service.get_unified_sessions(db, subject_id)
        return JSONResponse({"sessions": data})
    except ValueError as e:
        raise AppError(str(e), status_code=404)
    except Exception as e:
        logger.error(f"list_sessions error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.get("/sessions/{session_id}")
async def get_detail_session(session_id: int, db: Session = Depends(get_db)):
    try:
        data = exam_service.get_session_detail(db, session_id)
        return JSONResponse(data)
    except ValueError as e:
        raise AppError(str(e), status_code=404)
    except Exception as e:
        logger.error(f"get_session_detail error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.post("/sessions/{session_id}/retry-inplace", response_model=StatusMessage)
async def retry_session_inplace(
    session_id: int,
    payload: RetryRequest = RetryRequest(),
    db: Session = Depends(get_db),
):
    """Retry by resetting the SAME session (or creating new session if question_type differs)."""
    try:
        data = exam_service.retry_inplace(
            db, session_id,
            weak_topics=payload.weak_topics,
            question_type=payload.question_type,
        )
        return JSONResponse(data)
    except ValueError as e:
        raise AppError(str(e), status_code=400)
    except Exception as e:
        logger.error(f"retry_inplace error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.post("/sessions/{session_id}/retry", response_model=StatusMessage)
async def retry_session(
    session_id: int,
    payload: RetryRequest = RetryRequest(),
    db: Session = Depends(get_db),
):
    try:
        data = exam_service.unified_retry(
            db, session_id,
            weak_topics=payload.weak_topics,
            topic_filter=payload.topic_filter,
        )
        return JSONResponse(data)
    except ValueError as e:
        raise AppError(str(e), status_code=400)
    except Exception as e:
        logger.error(f"retry_session error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.post("/sessions/{session_id}/practice-questions", response_model=StatusMessage)
async def fetch_practice_questions(
    session_id: int,
    topic_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    try:
        data = exam_service.fetch_practice_questions(
            db, session_id, topic_filter=topic_filter,
        )
        return JSONResponse(data)
    except ValueError as e:
        raise AppError(str(e), status_code=404)
    except Exception as e:
        logger.error(f"fetch_practice_questions error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.post("/sessions/{session_id}/study-plan", response_model=StatusMessage)
async def save_session_study_plan(
    session_id: int,
    payload: StudyPlanRequest,
    db: Session = Depends(get_db),
):
    try:
        result = exam_service.save_study_plan(db, session_id, payload.model_dump())
        return JSONResponse(result)
    except Exception as e:
        logger.error(f"save_study_plan error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.post("/sessions/plan-item/{item_id}/toggle", response_model=StatusMessage)
async def toggle_session_plan_item(item_id: int, db: Session = Depends(get_db)):
    try:
        data = exam_service.toggle_plan_item(db, item_id)
        return JSONResponse(data)
    except Exception as e:
        logger.error(f"toggle_plan_item error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.post("/sessions/plan-item/{item_id}/submit-quiz", response_model=StatusMessage)
async def submit_plan_quiz(
    item_id: int,
    payload: SubmitPlanQuizRequest,
    db: Session = Depends(get_db),
):
    """Simpan hasil latihan quiz dari item rencana belajar."""
    try:
        data = exam_service.submit_plan_quiz(db, item_id, payload)
        return JSONResponse(data)
    except Exception as e:
        logger.error(f"submit_plan_quiz error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.post("/sessions/plan-item/{item_id}/submit-flashcards", response_model=StatusMessage)
async def submit_plan_flashcards(
    item_id: int,
    payload: SubmitPlanFlashcardsRequest,
    db: Session = Depends(get_db),
):
    """Catat review flashcard dari item rencana belajar + update SRS."""
    try:
        data = exam_service.submit_plan_flashcards(db, item_id, payload)
        return JSONResponse(data)
    except Exception as e:
        logger.error(f"submit_plan_flashcards error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)

class SummaryRequest(BaseModel):
    topic: str

@router.post("/sessions/{session_id}/summary", response_model=StatusMessage)
async def generate_session_summary(
    session_id: int,
    payload: SummaryRequest,
    db: Session = Depends(get_db),
):
    """Generate bite-sized summary for a topic."""
    try:
        data = exam_service.generate_study_plan_summary(db, session_id, payload.topic)
        return JSONResponse(data)
    except Exception as e:
        logger.error(f"generate_session_summary error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.delete("/sessions/{session_id}", response_model=StatusMessage)
async def delete_session(session_id: int, db: Session = Depends(get_db)):
    try:
        success = exam_service.delete_session(db, session_id)
        if not success:
            raise AppError("Sesi tidak ditemukan.", status_code=404)
        return JSONResponse({"status": "deleted"})
    except Exception as e:
        if isinstance(e, AppError):
            raise
        logger.error(f"delete_session error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)