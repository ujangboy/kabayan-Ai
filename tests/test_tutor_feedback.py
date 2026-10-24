"""
Tests untuk services/feedback_service.py

Fokus:
- Simpan rating baru (helpful / somewhat / not_helpful)
- Rating duplikat di-update, bukan dibuat baris baru
- Validasi rating & flag
- message_id tidak valid → ValueError (FK safety)
- chat_id diturunkan dari pesan (agar tidak melanggar foreign key)
- Statistik helpful_rate
"""
import pytest

from app import models
from app.services.feedback_service import feedback_service


@pytest.fixture()
def chat_with_message(db_session):
    chat = models.Chat(session_uuid="test-feedback-chat", title="Chat Test")
    db_session.add(chat)
    db_session.commit()
    db_session.refresh(chat)
    msg = models.Message(chat_id=chat.id, role="assistant", content="Jawaban tutor untuk diuji")
    db_session.add(msg)
    db_session.commit()
    db_session.refresh(msg)
    return chat, msg


class TestSaveFeedback:
    def test_simpan_feedback_helpful(self, db_session, chat_with_message):
        chat, msg = chat_with_message
        result = feedback_service.save_feedback(db_session, message_id=msg.id, rating="helpful")
        assert result["success"] is True
        row = db_session.query(models.TutorFeedback).filter_by(message_id=msg.id).first()
        assert row is not None
        assert row.rating == "helpful"
        assert row.chat_id == chat.id  # diturunkan dari pesan, bukan dari argumen
        assert result["impact"]["helpful_count"] == 1
        assert result["impact"]["helpful_rate"] == 1.0

    def test_rating_duplikat_diupdate(self, db_session, chat_with_message):
        chat, msg = chat_with_message
        feedback_service.save_feedback(db_session, message_id=msg.id, rating="helpful")
        feedback_service.save_feedback(db_session, message_id=msg.id, rating="not_helpful")

        rows = db_session.query(models.TutorFeedback).filter_by(message_id=msg.id).all()
        assert len(rows) == 1  # tidak duplikat
        assert rows[0].rating == "not_helpful"
        stats = feedback_service._feedback_stats(db_session)
        assert stats["total"] == 1
        assert stats["helpful_count"] == 0
        assert stats["not_helpful_count"] == 1

    def test_rating_tidak_valid_menolak(self, db_session, chat_with_message):
        chat, msg = chat_with_message
        with pytest.raises(ValueError):
            feedback_service.save_feedback(db_session, message_id=msg.id, rating="bagus")

    def test_flag_tidak_valid_menolak(self, db_session, chat_with_message):
        chat, msg = chat_with_message
        with pytest.raises(ValueError):
            feedback_service.save_feedback(
                db_session, message_id=msg.id, rating="helpful", flag="tidak_paham"
            )

    def test_message_tidak_ditemukan_menolak(self, db_session):
        with pytest.raises(ValueError):
            feedback_service.save_feedback(db_session, message_id=999999, rating="helpful")

    def test_komentar_dan_flag_tersimpan(self, db_session, chat_with_message):
        chat, msg = chat_with_message
        feedback_service.save_feedback(
            db_session,
            message_id=msg.id,
            rating="somewhat",
            comment="Kurang contoh soal",
            flag="unclear",
        )
        row = db_session.query(models.TutorFeedback).filter_by(message_id=msg.id).first()
        assert row.rating == "somewhat"
        assert row.comment == "Kurang contoh soal"
        assert row.flag == "unclear"

    def test_statistik_multi_feedback(self, db_session, chat_with_message):
        chat, msg = chat_with_message
        feedback_service.save_feedback(db_session, message_id=msg.id, rating="helpful")
        msg2 = models.Message(chat_id=chat.id, role="assistant", content="Jawaban kedua")
        db_session.add(msg2)
        db_session.commit()
        db_session.refresh(msg2)
        feedback_service.save_feedback(db_session, message_id=msg2.id, rating="not_helpful")

        stats = feedback_service._feedback_stats(db_session)
        assert stats["total"] == 2
        assert stats["helpful_count"] == 1
        assert stats["not_helpful_count"] == 1
        assert stats["helpful_rate"] == 0.5
