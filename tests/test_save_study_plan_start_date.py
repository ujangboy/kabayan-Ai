"""Regresi Fase D — Rencana Belajar dengan tanggal mulai (start_date).

User memilih tanggal mulai di ResultView; frontend mengirim `start_date`
di payload save. Backend harus:
1. parse `start_date` ISO (YYYY-MM-DD) ke kolom Date,
2. melanjutkan tanpa crash saat start_date tidak valid/absen,
3. menyimpan item rencana (Hari N) dengan tipe aktivitas.
"""

import json

import pytest

from app.models import ExamSession, StudyPlan
from app.services.exam_service import exam_service


def _plan_data(start_date=None, invalid_date=False):
    data = {
        "title": "Rencana Belajar Biologi",
        "motivational_message": "Semangat!",
        "priority_actions": ["Review topik 'Sel'"],
        "study_plan": [
            {"label": "Hari 1", "topic": "Struktur Sel", "activity": "Baca ulang materi",
             "type": "review", "duration_minutes": 45, "time_slot": "08:00–09:00",
             "resources": "2 soal latihan tersedia — topik Struktur Sel"},
            {"label": "Hari 7", "topic": "Simulasi Penuh", "activity": "Simulasi ujian penuh",
             "type": "simulation", "duration_minutes": 60, "time_slot": "19:00–20:00",
             "resources": "Kerjakan ulang Ujian Simulasi dengan materi: Cell.pdf"},
        ],
    }
    if invalid_date:
        data["start_date"] = "bukan-tanggal"
    elif start_date:
        data["start_date"] = start_date
    return data


def _make_session(db_session, make_subject):
    subject = make_subject("Biologi Sel")
    sess = ExamSession(
        blueprint_id=None,
        subject_id=subject.id,
        title="Ujian Biologi",
        status="completed",
        total_questions=3,
    )
    db_session.add(sess)
    db_session.commit()
    db_session.refresh(sess)
    return sess


def test_save_study_plan_persists_start_date(db_session, make_subject):
    sess = _make_session(db_session, make_subject)

    res = exam_service.save_study_plan(db_session, sess.id, _plan_data(start_date="2026-10-23"))
    # Router melakukan commit lewat get_db; di test kita commit manual
    # (fixture db_session memakai autoflush=False).
    db_session.commit()
    db_session.expire_all()

    assert res == {"status": "saved"}
    plan = db_session.query(StudyPlan).filter(StudyPlan.session_id == sess.id).one()
    assert plan.start_date is not None
    assert plan.start_date.isoformat() == "2026-10-23"
    labels = [i.day_label for i in plan.items]
    assert labels == ["Hari 1", "Hari 7"]
    types = {i.activity_type for i in plan.items}
    assert "simulation" in types


def test_save_study_plan_without_start_date_is_fine(db_session, make_subject):
    sess = _make_session(db_session, make_subject)

    exam_service.save_study_plan(db_session, sess.id, _plan_data())

    plan = db_session.query(StudyPlan).filter(StudyPlan.session_id == sess.id).one()
    assert plan.start_date is None


def test_save_study_plan_invalid_start_date_does_not_crash(db_session, make_subject):
    sess = _make_session(db_session, make_subject)

    exam_service.save_study_plan(db_session, sess.id, _plan_data(invalid_date=True))
    db_session.commit()
    db_session.expire_all()

    plan = db_session.query(StudyPlan).filter(StudyPlan.session_id == sess.id).one()
    assert plan.start_date is None
    assert len(plan.items) == 2


def _make_plan(db_session, make_subject, start_date=None):
    sess = _make_session(db_session, make_subject)
    exam_service.save_study_plan(
        db_session, sess.id, _plan_data(start_date=start_date)
    )
    db_session.commit()
    plan = db_session.query(StudyPlan).filter(StudyPlan.session_id == sess.id).one()
    first_item = sorted(plan.items, key=lambda item: item.order_number)[0]
    first_item.completed = True
    db_session.commit()
    return sess, plan, first_item


def test_update_start_date_keeps_items_and_progress(db_session, make_subject):
    sess, plan, first_item = _make_plan(
        db_session, make_subject, start_date="2026-10-23"
    )
    item_ids = sorted(item.id for item in plan.items)

    result = exam_service.update_study_plan_start_date(
        db_session, sess.id, "2026-11-01"
    )
    db_session.expire_all()

    updated = db_session.query(StudyPlan).filter(StudyPlan.session_id == sess.id).one()
    assert result == {"status": "updated", "start_date": "2026-11-01"}
    assert updated.start_date.isoformat() == "2026-11-01"
    assert sorted(item.id for item in updated.items) == item_ids
    assert bool(db_session.get(type(first_item), first_item.id).completed) is True


def test_update_start_date_rejects_invalid_date(db_session, make_subject):
    from fastapi import HTTPException

    sess, _, _ = _make_plan(db_session, make_subject, start_date="2026-10-23")

    with pytest.raises(HTTPException) as exc:
        exam_service.update_study_plan_start_date(db_session, sess.id, "31-10-2026")
    assert exc.value.status_code == 400


def test_update_start_date_missing_plan_returns_404(db_session):
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        exam_service.update_study_plan_start_date(db_session, 999999, "2026-11-01")
    assert exc.value.status_code == 404


def test_generate_study_plan_simulation_resources_lists_materials(db_session, make_subject):
    """Item Simulasi Penuh (hari 7) harus membawa daftar materi sebagai resources."""
    from app.models import Material
    from app.services.assessment_engine import generate_study_plan

    subject = make_subject("Biologi Sel")
    names = ["Sel Hewan.pdf", "Organel.docx", "Querl.docx-x"]
    for n in names:
        db_session.add(Material(
            subject_id=subject.id, filename=n,
            material_type="PDF", status="Ready",
        ))
    db_session.commit()

    plan = generate_study_plan(
        weak_topics=[{"topic": "Organel", "accuracy": 30, "priority": "Tinggi"}],
        strong_topics=[], score=40,
        subject_name="Biologi Sel",
        db=db_session, subject_id=subject.id,
    )

    simulation = [i for i in plan["study_plan"] if i["type"] == "simulation"]
    assert len(simulation) == 1
    res = simulation[0]["resources"]
    assert "Ujian Simulasi" in res
    # Nama materi siap-belajar disebut sebagai resource
    assert "Sel Hewan.pdf" in res
