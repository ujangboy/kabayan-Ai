"""D4 — exam_service.get_blueprints (endpoint yang sebelumnya 500: ExamBlueprint undefined)."""
from app.models import ExamBlueprint, ExamSession, StudyPlan, StudyPlanItem
from app.services.exam_service import exam_service


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


def test_get_session_detail_with_study_plan_returns_summary(db_session, make_subject):
    """Regresi: session dengan study plan tidak boleh 500 (AttributeError i.summary)."""
    subject = make_subject("Struktur Data")

    sess = ExamSession(subject_id=subject.id, status="active", title="UAS Struktur Data")
    db_session.add(sess)
    db_session.commit()
    db_session.refresh(sess)

    plan = StudyPlan(session_id=sess.id, title="Rencana 7 hari")
    db_session.add(plan)
    db_session.commit()
    db_session.refresh(plan)

    item = StudyPlanItem(plan_id=plan.id, order_number=1, day_label="Hari 1",
                         topic="Array", activity="Review Array", activity_type="review",
                         duration_minutes=30, time_slot="Pagi (08:00-09:00)",
                         resources=None, completed=0, summary="Rangkuman Array")
    db_session.add(item)
    db_session.commit()

    detail = exam_service.get_session_detail(db_session, sess.id)

    assert detail["study_plan"]["title"] == "Rencana 7 hari"
    items = detail["study_plan"]["items"]
    assert len(items) == 1
    assert items[0]["topic"] == "Array"
    assert items[0]["summary"] == "Rangkuman Array"


def test_get_unified_sessions_with_study_plan_does_not_crash(db_session, make_subject):
    """Regresi: riwayat ujian dengan study plan tidak boleh UnboundLocalError."""
    subject = make_subject("Basis Data")

    sess = ExamSession(subject_id=subject.id, status="active", title="UTS Basis Data")
    db_session.add(sess)
    db_session.commit()
    db_session.refresh(sess)

    plan = StudyPlan(session_id=sess.id, title="Rencana UTS")
    db_session.add(plan)
    db_session.commit()
    db_session.refresh(plan)

    item = StudyPlanItem(plan_id=plan.id, order_number=1, day_label="Hari 1",
                         topic="Normalisasi", activity="Review Normalisasi",
                         activity_type="review", duration_minutes=30,
                         time_slot="Pagi (08:00-09:00)", resources=None,
                         completed=0, summary="Rangkuman Normalisasi")
    db_session.add(item)
    db_session.commit()

    sessions = exam_service.get_unified_sessions(db_session, subject.id)

    assert len(sessions) == 1
    assert sessions[0]["id"] == sess.id
    assert sessions[0]["study_plan_progress"] == plan.progress
    assert sessions[0]["study_plan_items"][0]["material_names"] == []

