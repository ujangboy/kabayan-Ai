"""
Loop adaptif ujian → flashcard + konteks ujian di tutor.

Fokus uji:
  - generate_from_exam_review: membuat flashcard dari soal yang salah (mocked AI)
  - _gather_exam_context: ringkasan hasil ujian untuk tutor (skor, topik lemah, soal salah)
  - build_tutor_prompt + exam_context: template berisi blok hasil ujian
"""
import json
import datetime
from app.time_utils import utcnow

import pytest

from app.models import ExamSession, ExamAttempt, ExamReview, Subject
from app.services.flashcard_service import flashcard_service
from app.services.tutor_service import _gather_exam_context
from app.prompts.tutor import build_tutor_prompt


def _make_exam(db, subject, score=60, wrong_topics=("Topik Lemah",), submitted=True):
    session = ExamSession(
        subject_id=subject.id,
        subject_name=subject.name,
        title="Simulasi UTS",
        exam_type="UTS",
        status="completed" if submitted else "pending",
        score=score,
        total_correct=4,
        total_wrong=2,
        total_questions=6,
        weak_topics_json=json.dumps([{"topic": t, "accuracy": 33} for t in wrong_topics]),
        strong_topics_json=json.dumps([{"topic": "Topik Kuat", "mastery": "Baik"}]),
        evaluation_json=json.dumps({"overall_feedback": "Fokus pada topik lemah."}),
        submitted_at=utcnow() if submitted else None,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    attempt = ExamAttempt(
        session_id=session.id,
        attempt_number=1,
        score=score,
        total_correct=4,
        total_wrong=2,
        created_at=utcnow(),
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    rows = [
        ("Topik Kuat", "Pertanyaan benar 1", "A", 1),
        ("Topik Lemah", "Pertanyaan salah 1", "B", 0),
        ("Topik Lemah", "Pertanyaan salah 2", "C", 0),
    ]
    for topic, qtext, correct, is_correct in rows:
        db.add(ExamReview(
            attempt_id=attempt.id,
            question_number=1,
            topic=topic,
            question_text=qtext,
            question_type="mcq",
            user_answer="X",
            correct_answer=correct,
            is_correct=is_correct,
            ai_explanation="Penjelasan AI" if not is_correct else "",
        ))
    db.commit()
    return session


# ─── generate_from_exam_review ───────────────────────────────────────────────

def test_generate_from_exam_review_uses_wrong_reviews(db_session, make_subject, monkeypatch):
    subject = make_subject("Algoritma")
    session = _make_exam(db_session, subject)

    calls = {}

    def fake_generate(db, subject_id, context, count, title=None, material_ids=None):
        calls["subject_id"] = subject_id
        calls["count"] = count
        calls["title"] = title
        calls["context"] = context
        return {"count": count, "batch_id": "batch-test"}

    monkeypatch.setattr(flashcard_service, "generate_flashcards", fake_generate)

    result = flashcard_service.generate_from_exam_review(db_session, session.id, max_cards=8)

    assert result == {"count": 2, "batch_id": "batch-test"}
    assert calls["subject_id"] == subject.id
    assert calls["count"] == 2
    assert "Pertanyaan salah 1" in calls["context"]
    assert "Pertanyaan salah 2" in calls["context"]
    assert "Jawaban benar: B" in calls["context"]
    assert "Penjelasan AI" in calls["context"]
    assert "Ujian Algoritma" in calls["title"]


def test_generate_from_exam_review_no_wrong_returns_none(db_session, make_subject, monkeypatch):
    subject = make_subject("Algoritma")
    session = _make_exam(db_session, subject)
    # Mark semua review benar
    for rv in db_session.query(ExamReview).all():
        rv.is_correct = 1
    db_session.commit()

    def fake_generate(*args, **kwargs):
        raise AssertionError("generate_flashcards tidak boleh dipanggil")

    monkeypatch.setattr(flashcard_service, "generate_flashcards", fake_generate)

    assert flashcard_service.generate_from_exam_review(db_session, session.id) is None


def test_generate_from_exam_review_unknown_session_returns_none(db_session):
    assert flashcard_service.generate_from_exam_review(db_session, 99999) is None


# ─── _gather_exam_context ─────────────────────────────────────────────────────

def test_gather_exam_context_builds_summary(db_session, make_subject):
    subject = make_subject("Struktur Data")
    session = _make_exam(db_session, subject, score=60)

    ctx = _gather_exam_context(db_session, session.id)

    assert ctx
    assert "Struktur Data" in ctx
    assert "Skor: 60/100" in ctx
    assert "Salah: 2" in ctx
    assert "Topik lemah: Topik Lemah" in ctx
    assert "Topik kuat: Topik Kuat" in ctx
    assert "Pertanyaan salah 1" in ctx
    assert "Pertanyaan salah 2" in ctx
    assert "Fokus pada topik lemah." in ctx


def test_gather_exam_context_empty_for_none(db_session):
    assert _gather_exam_context(db_session, None) == ""


def test_gather_exam_context_empty_for_unknown(db_session):
    assert _gather_exam_context(db_session, 99999) == ""


def test_gather_exam_context_empty_for_unsubmitted(db_session, make_subject):
    subject = make_subject("Struktur Data")
    session = _make_exam(db_session, subject, submitted=False)
    assert _gather_exam_context(db_session, session.id) == ""


# ─── build_tutor_prompt + exam_context ───────────────────────────────────────

def test_build_tutor_prompt_injects_exam_context(db_session):
    template = build_tutor_prompt(
        student_level="intermediate",
        material_context="isi materi",
        exam_context="KONTEKS UJIAN: skor 60",
    )
    filled = template.format(
        mata_kuliah="Struktur Data",
        student_level="intermediate",
        history="",
        input="<pesan_siswa>kenapa nilai turun?</pesan_siswa>",
    )
    assert "KONTEKS HASIL UJIAN SISWA" in filled
    assert "KONTEKS UJIAN: skor 60" in filled
    assert "isi materi" in filled


def test_build_tutor_prompt_without_exam_context(db_session):
    template = build_tutor_prompt(student_level="intermediate")
    filled = template.format(
        mata_kuliah="Umum",
        student_level="intermediate",
        history="",
        input="<pesan_siswa>halo</pesan_siswa>",
    )
    assert "KONTEKS HASIL UJIAN SISWA" not in filled


# ─── Router: TutorChatRequest terima exam_session_id ─────────────────────────

def test_tutor_chat_request_accepts_exam_session_id():
    from app.routers.tutor import TutorChatRequest
    req = TutorChatRequest(
        message="kenapa nilai turun?",
        mata_kuliah="Struktur Data",
        exam_session_id=42,
    )
    assert req.exam_session_id == 42
    assert req.message == "kenapa nilai turun?"
