"""
Integration test untuk routers/tutor.py — alur streaming + metadata MSGID + feedback.

Menguji fungsi route secara langsung (tanpa TestClient) agar tidak memicu
side-effect main.py terhadap DB produksi. ai_service di-mock sehingga tidak
ada panggilan jaringan.
"""
import asyncio

import pytest

import models
from exceptions import AppError
from routers.tutor import (
    tutor_chat,
    tutor_feedback,
    TutorChatRequest,
    TutorFeedbackRequest,
)
from services.tutor_service import tutor_service as tutor_service_instance


# ─── Fake stream: ganti achat_stream agar deterministik & tanpa AI ───────────

async def _fake_stream(db, message, history, mata_kuliah=None, student_level="intermediate"):
    yield "\x00TYPE:SIMPLE\x00"
    yield "Jawaban dari FAQ: limit adalah nilai yang didekati."


@pytest.fixture(autouse=True)
def _mock_tutor_stream(monkeypatch):
    monkeypatch.setattr(tutor_service_instance, "achat_stream", _fake_stream)


def _consume(response):
    """Konsumsi seluruh chunk StreamingResponse."""
    async def run():
        out = []
        async for c in response.body_iterator:
            out.append(c)
        return out
    return asyncio.run(run())


class TestStreamMetadata:
    def test_stream_mengeluarkan_type_dan_msgid(self, db_session):
        req = TutorChatRequest(
            message="Apa itu limit?",
            history=[],
            session_id="sess-router-1",
            mata_kuliah="Matematika",
            student_level="beginner",
        )
        response = asyncio.run(tutor_chat(req, db=db_session))
        chunks = _consume(response)
        joined = "".join(chunks)

        # Marker TYPE diteruskan di body stream (klien yang melepas & menampilkan badge)
        assert joined.startswith("\x00TYPE:SIMPLE\x00")
        # Header X-Tutor-Type berisi tier hasil pre-classify (tidak pernah kosong)
        assert response.headers["x-tutor-type"] in ("SIMPLE", "MEDIUM", "COMPLEX")

        # Pesan tersimpan dengan metadata type/tokens_used
        saved = db_session.query(models.Message).filter(
            models.Message.role == "assistant"
        ).first()
        assert saved is not None
        assert saved.type == "simple"
        assert saved.tokens_used is not None and saved.tokens_used > 0

        # Trailing MSGID menunjuk id pesan yang tersimpan
        assert joined.endswith(f"\x00MSGID:{saved.id}\x00")
        assert joined.count("\x00MSGID:") == 1

    def test_stream_tanpa_session_id_tidak_menyimpan(self, db_session):
        req = TutorChatRequest(
            message="Apa itu limit?",
            history=[],
            session_id=None,
            mata_kuliah="Matematika",
        )
        response = asyncio.run(tutor_chat(req, db=db_session))
        chunks = _consume(response)
        joined = "".join(chunks)
        # Tidak ada MSGID (tidak ada chat untuk persist)
        assert "\x00MSGID:" not in joined


class TestFeedbackEndpoint:
    def _make_message(self, db_session):
        chat = models.Chat(session_uuid="fb-chat", title="t")
        db_session.add(chat)
        db_session.commit()
        db_session.refresh(chat)
        msg = models.Message(chat_id=chat.id, role="assistant", content="jwb")
        db_session.add(msg)
        db_session.commit()
        db_session.refresh(msg)
        return msg

    def test_feedback_sukses(self, db_session):
        msg = self._make_message(db_session)
        req = TutorFeedbackRequest(message_id=msg.id, rating="helpful")
        resp = asyncio.run(tutor_feedback(req, db=db_session))
        import json as _json
        data = _json.loads(resp.body)
        assert data["success"] is True
        assert data["impact"]["helpful_count"] == 1

    def test_feedback_rating_invalid_menjadi_app_error_400(self, db_session):
        msg = self._make_message(db_session)
        req = TutorFeedbackRequest(message_id=msg.id, rating="bagus")
        with pytest.raises(AppError) as exc_info:
            asyncio.run(tutor_feedback(req, db=db_session))
        assert exc_info.value.status_code == 400

    def test_feedback_message_tidak_ada_menjadi_app_error_400(self, db_session):
        req = TutorFeedbackRequest(message_id=999999, rating="helpful")
        with pytest.raises(AppError) as exc_info:
            asyncio.run(tutor_feedback(req, db=db_session))
        assert exc_info.value.status_code == 400
