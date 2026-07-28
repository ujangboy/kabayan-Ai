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

router = APIRouter(prefix="/api/exam", tags=["Exam Analyzer"])
logger = logging.getLogger(__name__)

# ─── Analysis ─────────────────────────────────────────────────────────────────

@router.post("/analyze/{subject_id}")
async def analyze_subject(subject_id: int, db: Session = Depends(get_db)):
    """
    Run AI knowledge analysis on all materials for a subject.
    Returns: overview, topic_priority, knowledge_map, weakness_indicators, stats.
    """
    try:
        data = exam_service.analyze(db, subject_id)
        return JSONResponse(data)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"detail": str(e)})
    except Exception as e:
        logger.error(f"analyze error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(e)})


# ─── Blueprint ────────────────────────────────────────────────────────────────

@router.post("/blueprint")
async def generate_blueprint(
    payload: BlueprintRequest,
    db: Session = Depends(get_db),
):
    """
    Generate and persist an exam blueprint.
    """
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
        return JSONResponse(status_code=400, content={"detail": str(e)})
    except Exception as e:
        from fastapi import HTTPException as _HTTPException
        if isinstance(e, _HTTPException):
            raise
        logger.error(f"blueprint error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(e)})


@router.get("/blueprints/{subject_id}")
async def get_blueprints(subject_id: int, db: Session = Depends(get_db)):
    """List all saved blueprints for a subject."""
    try:
        data = exam_service.get_blueprints(db, subject_id)
        return JSONResponse({"blueprints": data})
    except Exception as e:
        logger.error(f"get_blueprints error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(e)})


# ─── Question Generation ──────────────────────────────────────────────────────

@router.post("/generate/{blueprint_id}")
async def generate_questions(blueprint_id: int, db: Session = Depends(get_db)):
    """
    Generate all exam questions from a saved blueprint.
    Creates a new ExamSession. Returns session_id + full question list.
    """
    try:
        data = exam_service.generate_questions(db, blueprint_id)
        return JSONResponse(data)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"detail": str(e)})
    except Exception as e:
        logger.error(f"generate_questions error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(e)})


# ─── Session ──────────────────────────────────────────────────────────────────

@router.get("/session/{session_id}")
async def get_session(session_id: int, db: Session = Depends(get_db)):
    """Get full detail of an exam session (questions + answers + evaluation)."""
    try:
        data = exam_service.get_session_detail(db, session_id)
        return JSONResponse(data)
    except ValueError as e:
        return JSONResponse(status_code=404, content={"detail": str(e)})
    except Exception as e:
        logger.error(f"get_session error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(e)})


@router.get("/sessions/{subject_id}")
async def get_sessions(subject_id: int, db: Session = Depends(get_db)):
    """List all exam sessions for a subject."""
    try:
        data = exam_service.get_sessions(db, subject_id)
        return JSONResponse({"sessions": data})
    except Exception as e:
        logger.error(f"get_sessions error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(e)})


# ─── Submit & Evaluate ────────────────────────────────────────────────────────

@router.post("/submit/{session_id}")
async def submit_exam(
    session_id: int,
    payload: SubmitAnswersRequest,
    db: Session = Depends(get_db),
):
    """
    Submit user answers and trigger evaluation.
    """
    try:
        data = exam_service.submit_and_evaluate(db, session_id, payload.answers)
        return JSONResponse(data)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"detail": str(e)})
    except Exception as e:
        from fastapi import HTTPException as _HTTPException
        if isinstance(e, _HTTPException):
            raise
        logger.error(f"submit_exam error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(e)})


# ─── Recommendation ───────────────────────────────────────────────────────────

@router.get("/recommendation/{session_id}")
async def get_recommendation(session_id: int, db: Session = Depends(get_db)):
    """Get AI learning recommendation after exam evaluation."""
    try:
        data = exam_service.get_recommendation(db, session_id)
        return JSONResponse(data)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"detail": str(e)})
    except Exception as e:
        logger.error(f"get_recommendation error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(e)})


# ─── Retry from Question Bank (zero AI) ──────────────────────────────────────

@router.post("/retry/{blueprint_id}")
async def retry_exam(
    blueprint_id: int,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
):
    """
    Create a new exam session by shuffling from the saved question bank.
    No AI call. Accepts optional weak_topics list for prioritised selection.
    """
    try:
        weak_topics = payload.get("weak_topics", [])
        data = exam_service.retry_from_bank(db, blueprint_id, weak_topics)
        return JSONResponse(data)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"detail": str(e)})
    except Exception as e:
        logger.error(f"retry_exam error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(e)})


# ─── Lazy AI explanation ──────────────────────────────────────────────────────

@router.post("/explain")
async def get_explanation(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    """
    Return AI explanation for a single question.
    Checks question bank cache first; only calls AI if no explanation stored.

    Body: { bank_id (optional int), question, correct_answer, topic }
    """
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
        return JSONResponse(status_code=500, content={"detail": str(e)})


# ─── Question Bank stats ──────────────────────────────────────────────────────

@router.get("/bank/stats/{subject_id}")
async def bank_stats(subject_id: int, db: Session = Depends(get_db)):
    """Return question count by topic/difficulty for a subject."""
    try:
        data = exam_service.get_bank_stats(db, subject_id)
        return JSONResponse({"stats": data})
    except Exception as e:
        logger.error(f"bank_stats error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(e)})


# ═══════════════════════════════════════════════════════════════════════════════
# UNIFIED SESSION MANAGEMENT (consolidated from exam_history.py)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/sessions")
async def list_unified_sessions(
    subject_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """List all exam sessions (active & completed), ordered by started_at desc."""
    try:
        data = exam_service.get_unified_sessions(db, subject_id)
        return JSONResponse({"sessions": data})
    except ValueError as e:
        return JSONResponse(status_code=404, content={"detail": str(e)})
    except Exception as e:
        from fastapi import HTTPException as _HTTPException
        if isinstance(e, _HTTPException):
            raise
        logger.error(f"list_sessions error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(e)})


@router.get("/sessions/{session_id}")
async def get_detail_session(session_id: int, db: Session = Depends(get_db)):
    """Full detail of one session with attempts, reviews, study plan."""
    try:
        data = exam_service.get_session_detail(db, session_id)
        return JSONResponse(data)
    except ValueError as e:
        return JSONResponse(status_code=404, content={"detail": str(e)})
    except Exception as e:
        from fastapi import HTTPException as _HTTPException
        if isinstance(e, _HTTPException):
            raise
        logger.error(f"get_session_detail error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(e)})


@router.post("/sessions/{session_id}/retry")
async def retry_session(
    session_id: int,
    payload: RetryRequest = RetryRequest(),
    db: Session = Depends(get_db),
):
    """Create a new exam session from question bank (zero AI) for the same session."""
    try:
        data = exam_service.unified_retry(db, session_id)
        return JSONResponse(data)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"detail": str(e)})
    except Exception as e:
        from fastapi import HTTPException as _HTTPException
        if isinstance(e, _HTTPException):
            raise
        logger.error(f"retry_session error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(e)})


@router.post("/sessions/{session_id}/study-plan")
async def save_session_study_plan(
    session_id: int,
    payload: StudyPlanRequest,
    db: Session = Depends(get_db),
):
    """Save or replace the study plan for a session."""
    try:
        result = exam_service.save_study_plan(db, session_id, payload.model_dump())
        return JSONResponse(result)
    except Exception as e:
        from fastapi import HTTPException as _HTTPException
        if isinstance(e, _HTTPException):
            raise
        logger.error(f"save_study_plan error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(e)})


@router.post("/sessions/plan-item/{item_id}/toggle")
async def toggle_session_plan_item(item_id: int, db: Session = Depends(get_db)):
    try:
        data = exam_service.toggle_plan_item(db, item_id)
        return JSONResponse(data)
    except Exception as e:
        from fastapi import HTTPException as _HTTPException
        if isinstance(e, _HTTPException):
            raise
        logger.error(f"toggle_plan_item error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(e)})


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: int, db: Session = Depends(get_db)):
    try:
        success = exam_service.delete_session(db, session_id)
        if not success:
            return JSONResponse(status_code=404, content={"detail": "Sesi tidak ditemukan."})
        return JSONResponse({"status": "deleted"})
    except Exception as e:
        from fastapi import HTTPException as _HTTPException
        if isinstance(e, _HTTPException):
            raise
        logger.error(f"delete_session error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"detail": str(e)})
