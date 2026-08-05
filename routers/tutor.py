"""
Tutor Router — Kabayan AI Tutor endpoints.

Endpoints:
  POST /api/tutor/chat      — main streaming chat (hybrid SIMPLE/MEDIUM/COMPLEX)
  POST /api/tutor/classify  — classify a message without generating a response
  GET  /api/tutor/faq       — list FAQ entries (debug/admin)

Streaming shape is identical to /api/chat:
  - StreamingResponse with media_type="text/plain"
  - Header X-Tutor-Type: SIMPLE | MEDIUM | COMPLEX
  - First bytes contain "\x00TYPE:<type>\x00" which the service strips before UI display

Chat history persistence reuses the existing Chat/Message tables (via chat_repository).
Messages get the new nullable `type` and `tokens_used` columns populated.
"""

import asyncio
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from repositories.chat_repository import chat_repository
from services.tutor_service import tutor_service
from services.faq_service import faq_service
from services.feedback_service import feedback_service
from services.tutor_profile_service import (
    get_or_create_profile,
    record_message,
)
from exceptions import AppError

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Request / Response schemas ───────────────────────────────────────────────

class TutorMessage(BaseModel):
    role: str
    content: str


class TutorChatRequest(BaseModel):
    message: str = Field(..., max_length=1000)
    history: List[TutorMessage] = Field(default_factory=list)
    session_id: Optional[str] = None
    mata_kuliah: Optional[str] = None
    student_level: str = Field(default="intermediate")  # beginner / intermediate / advanced


class TutorClassifyRequest(BaseModel):
    message: str
    history: List[TutorMessage] = Field(default_factory=list)


class TutorFeedbackRequest(BaseModel):
    message_id: int
    rating: str
    comment: Optional[str] = None
    flag: Optional[str] = None
    mata_kuliah: Optional[str] = None


# ─── Helper: estimate token count ────────────────────────────────────────────

def _estimate_tokens(text: str) -> int:
    """Rough estimate: 1 token ≈ 4 characters."""
    return max(1, len(text) // 4)


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/api/tutor/chat")
async def tutor_chat(request: TutorChatRequest, db: Session = Depends(get_db)):
    """
    Streaming tutor chat endpoint.

    Response format: plain text stream.
    Header X-Tutor-Type indicates SIMPLE / MEDIUM / COMPLEX routing.
    The first bytes "\x00TYPE:<type>\x00" are metadata and should be stripped by the client.
    """
    try:
        # Persist or get chat session
        chat_id: Optional[int] = None
        if request.session_id:
            chat = chat_repository.get_or_create_by_uuid(db, request.session_id)
            chat_id = chat.id
            chat_repository.add_message(db, chat_id, "user", request.message)
            db.commit()

        hist_dicts = [{"role": m.role, "content": m.content} for m in request.history[-20:]]

        # Pre-classify (0 token, murni logika lokal) agar header X-Tutor-Type
        # berisi tier yang benar sejak awal respons dibangun.
        header_tier = "MEDIUM"
        try:
            header_tier = tutor_service.classify_message(request.message, hist_dicts)["type"]
        except Exception:
            pass
        detected_tier: list[str] = [header_tier]  # mutable agar bisa di-update saat stream

        async def stream_and_persist():
            full_response = ""
            first_chunk = True
            saved_message_id: Optional[int] = None

            try:
                async for chunk in tutor_service.achat_stream(
                    db=db,
                    message=request.message,
                    history=hist_dicts,
                    mata_kuliah=request.mata_kuliah,
                    student_level=request.student_level,
                ):
                    # First chunk contains TYPE metadata header "\x00TYPE:XXX\x00".
                    # Marker diteruskan ke klien (frontend yang melepas & menampilkan
                    # badge), karena header HTTP tidak bisa diubah setelah stream mulai.
                    if first_chunk:
                        first_chunk = False
                        if chunk.startswith("\x00TYPE:"):
                            end = chunk.find("\x00", 6)
                            if end != -1:
                                detected_tier[0] = chunk[6:end]
                                # Sisanya setelah marker (biasanya kosong) ikut diteruskan
                                yield chunk
                                remainder = chunk[end + 1:]
                                if remainder:
                                    full_response += remainder
                                    yield remainder
                            continue
                        # No header (shouldn't happen) — treat as content
                        full_response += chunk
                        yield chunk
                    else:
                        full_response += chunk
                        yield chunk
            finally:
                # Persist assistant message with tutor metadata (runs even on error)
                if chat_id and full_response:
                    try:
                        from models import Message
                        import datetime
                        msg = Message(
                            chat_id=chat_id,
                            role="assistant",
                            content=full_response,
                            type=detected_tier[0].lower(),
                            tokens_used=_estimate_tokens(full_response),
                        )
                        db.add(msg)
                        db.commit()
                        db.refresh(msg)
                        saved_message_id = msg.id
                        record_message(db, tokens=_estimate_tokens(full_response))
                    except Exception as persist_exc:
                        logger.warning("Failed to persist tutor message: %s", persist_exc)
                        db.rollback()

            # Trailing metadata with the saved message id — emitted only when the
            # stream completed normally (client disconnect raises GeneratorExit
            # inside the generator, so this line never runs in that case).
            if saved_message_id is not None:
                yield f"\x00MSGID:{saved_message_id}\x00"

        headers = {
            "X-Chat-Id": str(chat_id) if chat_id else "",
            "X-Tutor-Type": detected_tier[0],
        }
        return StreamingResponse(
            stream_and_persist(),
            media_type="text/plain",
            headers=headers,
        )

    except ValueError as exc:
        raise AppError(str(exc), status_code=400)
    except Exception as exc:
        raise AppError(str(exc), status_code=500)


@router.post("/api/tutor/classify")
async def tutor_classify(request: TutorClassifyRequest):
    """
    Classify a message without generating a response.
    Useful for observability and testing the classifier.
    """
    try:
        hist_dicts = [{"role": m.role, "content": m.content} for m in request.history]
        result = tutor_service.classify_message(request.message, hist_dicts)
        return JSONResponse(result)
    except Exception as exc:
        raise AppError(str(exc), status_code=500)


@router.post("/api/tutor/feedback")
async def tutor_feedback(request: TutorFeedbackRequest, db: Session = Depends(get_db)):
    """
    Simpan rating siswa terhadap satu respons tutor.

    Request: {"message_id", "rating", "comment"?, "flag"?, "mata_kuliah"?}
    Rating: helpful | somewhat | not_helpful
    Flag:   incorrect | unclear | irrelevant | inappropriate
    """
    try:
        result = feedback_service.save_feedback(
            db,
            message_id=request.message_id,
            rating=request.rating,
            comment=request.comment,
            flag=request.flag,
        )
        return JSONResponse(result)
    except ValueError as exc:
        raise AppError(str(exc), status_code=400)
    except Exception as exc:
        logger.exception("feedback endpoint error")
        raise AppError(str(exc), status_code=500)


@router.get("/api/tutor/faq")
async def list_faq(
    mata_kuliah: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """List FAQ entries. Optionally filter by mata_kuliah."""
    try:
        faqs = faq_service.get_all_faq(db, mata_kuliah=mata_kuliah, limit=limit)
        return JSONResponse({
            "total": len(faqs),
            "mata_kuliah": mata_kuliah,
            "faqs": [
                {
                    "id": f.id,
                    "mata_kuliah": f.mata_kuliah,
                    "topic": f.topic,
                    "question": f.question,
                    "difficulty": f.difficulty,
                    "usage_count": f.usage_count,
                }
                for f in faqs
            ],
        })
    except Exception as exc:
        raise AppError(str(exc), status_code=500)


@router.get("/api/tutor/profile")
async def get_tutor_profile(db: Session = Depends(get_db)):
    """Return the adaptive tutor profile for the current user."""
    try:
        profile = get_or_create_profile(db)
        return JSONResponse({
            "user_key": profile.user_key,
            "estimated_level": profile.estimated_level,
            "topics_mastery": profile.topics_mastery,
            "weak_topics": profile.weak_topics,
            "strong_topics": profile.strong_topics,
            "explanation_depth": profile.explanation_depth,
            "response_length": profile.response_length,
            "use_formulas": profile.use_formulas,
            "use_examples": profile.use_examples,
            "use_step_by_step": profile.use_step_by_step,
            "total_sessions": profile.total_sessions,
            "total_messages": profile.total_messages,
            "total_tokens": profile.total_tokens,
            "helpful_count": profile.helpful_count,
            "not_helpful_count": profile.not_helpful_count,
            "helpful_rate": profile.helpful_rate,
        })
    except Exception as exc:
        raise AppError(str(exc), status_code=500)
