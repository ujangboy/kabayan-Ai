"""
Regression test: feedback untuk kedua mode (Tutor & Kabayan).

- /api/chat sekarang juga emit trailing "\x00MSGID:n\x00" agar client bisa
  mengirim feedback (sebelumnya Kabayan tidak punya msgId -> feedback 422/400).
- feedback_service menormalisasi alias rating (up/down) agar client lama tidak 400.
"""
import asyncio

from app import models
import pytest

from app.routers.chat import chat_endpoint, ChatRequest
from app.services.feedback_service import feedback_service
from app.services.ai_service import ai_service as ai_service_instance


async def _fake_stream(hist_dicts, context, message):
    yield "Jawaban sederhana tanpa metadata."


@pytest.fixture(autouse=True)
def _mock_ai_stream(monkeypatch):
    monkeypatch.setattr(ai_service_instance, "achat_stream", _fake_stream)


def _consume(response):
    async def run():
        out = []
        async for c in response.body_iterator:
            out.append(c)
        return out
    return asyncio.run(run())


class TestChatMsgidEmission:
    def test_chat_mengeluarkan_msgid_trailing(self, db_session):
        req = ChatRequest(
            message="Jelaskan limit fungsi.",
            history=[],
            session_id="sess-chat-fb-1",
        )
        response = asyncio.run(chat_endpoint(req, db=db_session))
        joined = "".join(_consume(response))

        saved = db_session.query(models.Message).filter(
            models.Message.role == "assistant"
        ).first()
        assert saved is not None
        assert joined.endswith(f"\x00MSGID:{saved.id}\x00")
        assert joined.count("\x00MSGID:") == 1

    def test_chat_tanpa_session_id_tidak_menyimpan(self, db_session):
        req = ChatRequest(message="Halo", history=[], session_id=None)
        response = asyncio.run(chat_endpoint(req, db=db_session))
        joined = "".join(_consume(response))
        assert "\x00MSGID:" not in joined


class TestRatingAlias:
    def _make_message(self, db_session):
        chat = models.Chat(session_uuid="fb-alias-chat", title="t")
        db_session.add(chat)
        db_session.commit()
        db_session.refresh(chat)
        msg = models.Message(chat_id=chat.id, role="assistant", content="jwb")
        db_session.add(msg)
        db_session.commit()
        db_session.refresh(msg)
        return msg

    @pytest.mark.parametrize("client_rating,expected", [
        ("up", "helpful"),
        ("down", "not_helpful"),
        ("like", "helpful"),
        ("helpful", "helpful"),
        ("not_helpful", "not_helpful"),
    ])
    def test_alias_dinormalisasi(self, db_session, client_rating, expected):
        msg = self._make_message(db_session)
        result = feedback_service.save_feedback(
            db_session, message_id=msg.id, rating=client_rating
        )
        assert result["success"] is True
        stored = db_session.query(models.TutorFeedback).filter(
            models.TutorFeedback.message_id == msg.id
        ).first()
        assert stored.rating == expected
