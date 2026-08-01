import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query, Body
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from services.exam_service import exam_service
from schemas.exam import (
    BlueprintRequest,
    SubmitAnswersRequest,
    RetryRequest,
    StudyPlanRequest,
)
from exceptions import AppError

router = APIRouter(prefix="/api/exam", tags=["Exam Analyzer"])
logger = logging.getLogger(__name__)


@router.post("/analyze/{subject_id}")
async def analyze_subject(subject_id: int, db: Session = Depends(get_db)):
    try:
        data = exam_service.analyze(db, subject_id)
        return JSONResponse(data)
    except ValueError as e:
        raise AppError(str(e), status_code=400)
    except Exception as e:
        logger.error(f"analyze error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.post("/blueprint")
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


@router.post("/generate/{blueprint_id}")
async def generate_questions(blueprint_id: int, db: Session = Depends(get_db)):
    try:
        data = exam_service.generate_questions(db, blueprint_id)
        return JSONResponse(data)
    except ValueError as e:
        raise AppError(str(e), status_code=400)
    except Exception as e:
        logger.error(f"generate_questions error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.get("/session/{session_id}")
async def get_session(session_id: int, db: Session = Depends(get_db)):
    try:
        data = exam_service.get_session_detail(db, session_id)
        return JSONResponse(data)
    except ValueError as e:
        raise AppError(str(e), status_code=404)
    except Exception as e:
        logger.error(f"get_session error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.post("/submit/{session_id}")
async def submit_exam(
    session_id: int,
    payload: SubmitAnswersRequest,
    db: Session = Depends(get_db),
):
    try:
        data = exam_service.submit_and_evaluate(db, session_id, payload.answers)
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


@router.post("/retry/{blueprint_id}")
async def retry_exam(
    blueprint_id: int,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
):
    try:
        weak_topics = payload.get("weak_topics", [])
        data = exam_service.retry_from_bank(db, blueprint_id, weak_topics)
        return JSONResponse(data)
    except ValueError as e:
        raise AppError(str(e), status_code=400)
    except Exception as e:
        logger.error(f"retry_exam error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.post("/explain")
async def get_explanation(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    try:
        explanation = exam_service.get_explanation(
            db=db,
            bank_id=payload.get("bank_id"),
            question_text=payload.get("question", ""),
            correct_answer=payload.get("correct_answer", ""),
            topic=payload.get("topic", ""),
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


@router.post("/sessions/{session_id}/retry-inplace")
async def retry_session_inplace(
    session_id: int,
    payload: RetryRequest = RetryRequest(),
    db: Session = Depends(get_db),
):
    """Retry by resetting the SAME session — no new history row created."""
    try:
        data = exam_service.retry_inplace(
            db, session_id,
            weak_topics=payload.weak_topics,
        )
        return JSONResponse(data)
    except ValueError as e:
        raise AppError(str(e), status_code=400)
    except Exception as e:
        logger.error(f"retry_inplace error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.post("/sessions/{session_id}/retry")
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


@router.post("/sessions/{session_id}/practice-questions")
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


@router.post("/sessions/{session_id}/study-plan")
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


@router.post("/sessions/plan-item/{item_id}/toggle")
async def toggle_session_plan_item(item_id: int, db: Session = Depends(get_db)):
    try:
        data = exam_service.toggle_plan_item(db, item_id)
        return JSONResponse(data)
    except Exception as e:
        logger.error(f"toggle_plan_item error: {e}", exc_info=True)
        raise AppError(str(e), status_code=500)


@router.delete("/sessions/{session_id}")
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