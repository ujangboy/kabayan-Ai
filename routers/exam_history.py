import json
import logging
from fastapi import APIRouter, Depends, Body
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from services.exam_history_service import exam_history_service

router = APIRouter(prefix="/api/history", tags=["Exam History"])
logger = logging.getLogger(__name__)


def _safe_int(val, field_name: str, allow_none=False):
    if val is None:
        if allow_none:
            return None
        raise ValueError(f"Field {field_name} tidak boleh kosong.")
    if isinstance(val, str) and str(val).strip() == "":
        if allow_none:
            return None
        raise ValueError(f"Field {field_name} tidak boleh kosong string.")
    try:
        return int(val)
    except (ValueError, TypeError):
        raise ValueError(f"Field {field_name} harus berupa angka bulat (integer).")

# ─── Save session (Selesai button) ────────────────────────────────────────────
@router.post("/save")
async def save_history(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    """
    Called when user clicks "Selesai" after reviewing exam results.
    Persists the full exam result, attempt, per-question reviews, and study plan.
    """
    try:
        required = [
            "subject_id", "subject_name", "title", "exam_type", "difficulty",
            "score", "total_correct", "total_wrong",
            "evaluation_json", "questions_json", "answers_json",
        ]
        missing = [f for f in required if f not in payload]
        if missing:
            return JSONResponse(status_code=422, content={"detail": f"Field wajib tidak ada: {missing}"})

        result = exam_history_service.save_session(
            db=db,
            subject_id=_safe_int(payload.get("subject_id"), "subject_id"),
            subject_name=payload.get("subject_name"),
            title=payload.get("title"),
            exam_type=payload.get("exam_type"),
            difficulty=payload.get("difficulty", "menengah"),
            bloom_level=payload.get("bloom_level", "mixed"),
            question_type=payload.get("question_type", "mixed"),
            total_questions=_safe_int(payload.get("total_questions", 0), "total_questions"),
            score=_safe_int(payload.get("score"), "score"),
            total_correct=_safe_int(payload.get("total_correct"), "total_correct"),
            total_wrong=_safe_int(payload.get("total_wrong"), "total_wrong"),
            evaluation_json_str=payload.get("evaluation_json"),
            questions_json_str=payload.get("questions_json"),
            answers_json_str=payload.get("answers_json"),
            study_plan_data=payload.get("study_plan_data"),
            duration_seconds=_safe_int(payload.get("duration_seconds"), "duration_seconds", allow_none=True),
        )
        return JSONResponse(result)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"detail": str(e)})
    except Exception as e:
        logger.error(f"save_history error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(e)})


# ─── Save retry attempt ────────────────────────────────────────────────────────
@router.post("/retry/{history_session_id}")
async def save_retry(
    history_session_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    """
    Save a new attempt on an existing history session.
    Body: score, total_correct, total_wrong, evaluation_json, questions_json, answers_json
    """
    try:
        result = exam_history_service.save_retry_attempt(
            db=db,
            history_session_id=history_session_id,
            score=_safe_int(payload.get("score"), "score"),
            total_correct=_safe_int(payload.get("total_correct", 0), "total_correct"),
            total_wrong=_safe_int(payload.get("total_wrong", 0), "total_wrong"),
            evaluation_json_str=payload.get("evaluation_json"),
            questions_json_str=payload.get("questions_json"),
            answers_json_str=payload.get("answers_json"),
            duration_seconds=_safe_int(payload.get("duration_seconds"), "duration_seconds", allow_none=True),
        )
        return JSONResponse(result)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"detail": str(e)})
    except Exception as e:
        logger.error(f"save_retry error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(e)})


# ─── List history ─────────────────────────────────────────────────────────────
@router.get("/list")
async def list_history(subject_id: int = None, db: Session = Depends(get_db)):
    try:
        data = exam_history_service.get_history_list(db, subject_id)
        return JSONResponse({"sessions": data})
    except Exception as e:
        logger.error(f"list_history error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(e)})


# ─── Session detail ───────────────────────────────────────────────────────────
@router.get("/detail/{history_session_id}")
async def get_detail(history_session_id: int, db: Session = Depends(get_db)):
    try:
        data = exam_history_service.get_session_detail(db, history_session_id)
        return JSONResponse(data)
    except ValueError as e:
        return JSONResponse(status_code=404, content={"detail": str(e)})
    except Exception as e:
        logger.error(f"get_detail error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(e)})


# ─── Save study plan to existing session ──────────────────────────────────────
@router.post("/study-plan/{history_session_id}")
async def save_study_plan(
    history_session_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    """Save or replace the study plan for an existing history session."""
    try:
        result = exam_history_service.save_study_plan(db, history_session_id, payload)
        return JSONResponse(result)
    except Exception as e:
        logger.error(f"save_study_plan error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(e)})


# ─── Toggle study plan item ───────────────────────────────────────────────────
@router.post("/plan-item/{item_id}/toggle")
async def toggle_plan_item(item_id: int, db: Session = Depends(get_db)):
    try:
        data = exam_history_service.toggle_plan_item(db, item_id)
        return JSONResponse(data)
    except ValueError as e:
        return JSONResponse(status_code=404, content={"detail": str(e)})
    except Exception as e:
        logger.error(f"toggle_plan_item error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(e)})


# ─── Delete session ───────────────────────────────────────────────────────────
@router.delete("/delete/{history_session_id}")
async def delete_session(history_session_id: int, db: Session = Depends(get_db)):
    try:
        success = exam_history_service.delete_session(db, history_session_id)
        if not success:
            return JSONResponse(status_code=404, content={"detail": "Session tidak ditemukan."})
        return JSONResponse({"status": "deleted"})
    except Exception as e:
        logger.error(f"delete_session error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(e)})
