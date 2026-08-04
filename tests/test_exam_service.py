"""D4 — exam_service.get_blueprints (endpoint yang sebelumnya 500: ExamBlueprint undefined)."""
from models import ExamBlueprint, ExamSession
from services.exam_service import exam_service


def test_get_blueprints_returns_list(db_session, make_subject):
    subject = make_subject("Struktur Data")

    bp = ExamBlueprint(subject_id=subject.id, title="UAS Struktur Data", exam_type="uas", difficulty="menengah", total_questions=10, duration_minutes=90)
    db_session.add(bp)
    db_session.commit()
    db_session.refresh(bp)

    sess = ExamSession(blueprint_id=bp.id, subject_id=subject.id, status="active")
    db_session.add(sess)
    db_session.commit()

    bps = exam_service.get_blueprints(db_session, subject.id)

    assert isinstance(bps, list)
    assert len(bps) == 1
    assert bps[0]["title"] == "UAS Struktur Data"
    assert bps[0]["session_count"] == 1


def test_get_blueprints_empty_subject(db_session, make_subject):
    subject = make_subject("Kosong")

    bps = exam_service.get_blueprints(db_session, subject.id)

    assert bps == []
