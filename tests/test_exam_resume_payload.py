"""Regresi fitur "Lanjutkan Ujian": detail sesi active harus menyediakan
questions + answers + started_at + status supaya kuis bisa dibuka kembali
dengan sisa waktu yang dihitung dari started_at (frontend menghitung
elapsed dari timestamp backend)."""

import json
from datetime import datetime

from models import ExamSession
from services.exam_service import exam_service


def test_active_session_detail_contains_resume_payload(db_session, make_subject):
    subject = make_subject("Biologi")
    questions = {
        "title": "Ujian Simulasi Biologi",
        "duration_minutes": 30,
        "questions": [
            {
                "id": 1,
                "type": "mcq",
                "question": "Sel adalah unit ...",
                "topic": "Struktur Sel",
                "options": {"A": "fungsional", "B": "reProduksi"},
                "answer": "A",
            },
        ],
    }
    sess = ExamSession(
        blueprint_id=None,
        subject_id=subject.id,
        title="Ujian Simulasi Biologi",
        total_questions=1,
        status="active",
        started_at=datetime(2026, 10, 23, 6, 0, 0),
        questions_json=json.dumps(questions, ensure_ascii=False),
        answers_json=json.dumps({"1": "A"}),
    )
    db_session.add(sess)
    db_session.commit()
    db_session.refresh(sess)

    detail = exam_service.get_session_detail(db_session, sess.id)

    assert detail["status"] == "active"
    assert detail["submitted"] is False
    assert detail["started_at"] is not None
    assert detail["duration_minutes"] == 30
    assert isinstance(detail["questions"], list) and len(detail["questions"]) == 1
    assert detail["answers"] == {"1": "A"}


def test_completed_session_detail_reports_submitted(db_session, make_subject):
    """Setelah submit, resume di frontend harus menolak (status bukan active)."""
    subject = make_subject("Fisika")
    questions = {
        "duration_minutes": 30,
        "questions": [{"id": 1, "type": "truefalse", "question": "x", "answer": "true"}],
    }
    sess = ExamSession(
        blueprint_id=None,
        subject_id=subject.id,
        title="Ujian Fisika",
        status="completed",
        score=0,
        total_questions=1,
        submitted_at=datetime(2026, 10, 23, 7, 0, 0),
        questions_json=json.dumps(questions, ensure_ascii=False),
        answers_json=json.dumps({"1": "true"}),
    )
    db_session.add(sess)
    db_session.commit()
    db_session.refresh(sess)

    detail = exam_service.get_session_detail(db_session, sess.id)

    assert detail["status"] == "completed"
    assert detail["submitted"] is True
