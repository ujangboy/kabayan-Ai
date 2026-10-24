"""
Test Daily Planner (engines/daily_planner.py + GET /api/study/daily-plan) — PRD US4.3.

Fokus uji:
  - Item flashcard dari kartu due + baru (FSRS)
  - Item remedial dari topik lemah (mastery < 70)
  - Durasi total tidak melebihi free_minutes
  - Plan kosong → empty_reason
  - Prioritas: flashcard dulu, lalu remedial
  - Endpoint: 200 valid, 404 subject hilang, clamp free_minutes
"""
import asyncio
import datetime
from app.time_utils import utcnow
import json

from app import models
from app.engines.daily_planner import generate_daily_plan
from app.routers.study import study_daily_plan


def _card(db, subject_id, due=True, new=False, times_seen=1, times_correct=1):
    now = utcnow()
    fc = models.Flashcard(
        subject_id=subject_id, question="q", answer="a",
        times_seen=times_seen, times_correct=times_correct,
        interval=1, ease_factor=250, mastered=0,
    )
    if new:
        fc.next_review = None
    elif due:
        fc.next_review = now - datetime.timedelta(days=1)
    else:
        fc.next_review = now + datetime.timedelta(days=10)
    db.add(fc)
    return fc


def _weak_profile(db, subject_id, topic, accuracy):
    db.add(models.LearningProfile(
        user_key="local", subject_id=subject_id,
        topics_mastery=json.dumps({topic: {"accuracy": accuracy, "attempts": 2, "sessions": 2}}),
        weak_topics=json.dumps([topic]),
        strong_topics="[]",
        total_sessions=2, total_questions=2, total_correct=0,
    ))
    db.commit()


class TestFsrsItems:
    def test_due_cards_create_flashcard_item(self, db_session, make_subject):
        subj = make_subject()
        now = utcnow()
        for i in range(10):
            _card(db_session, subj.id, due=True)
        for i in range(2):
            _card(db_session, subj.id, new=True, times_seen=0)
        _card(db_session, subj.id, due=False)  # tidak jatuh tempo
        db_session.commit()

        plan = generate_daily_plan(db_session, free_minutes=60, subject_id=subj.id)
        flashcard_items = [i for i in plan["items"] if i["type"] == "flashcard"]
        assert len(flashcard_items) == 1
        item = flashcard_items[0]
        assert item["subject_name"] == subj.name
        assert "10 kartu jatuh tempo" in item["reason"]
        assert "2 kartu baru" in item["reason"]
        # estimasi 12 kartu × 30s = 6 menit (tanpa cap)
        assert item["duration_minutes"] == 6

    def test_flashcard_cap(self, db_session, make_subject):
        subj = make_subject()
        # ikasili banyak kartu → durasi cap di 20 menit
        for i in range(100):
            _card(db_session, subj.id, due=True)
        db_session.commit()

        plan = generate_daily_plan(db_session, free_minutes=60, subject_id=subj.id)
        item = [i for i in plan["items"] if i["type"] == "flashcard"][0]
        assert item["duration_minutes"] == 20


class TestRemedial:
    def test_weak_topic_creates_remedial(self, db_session, make_subject):
        subj = make_subject()
        _weak_profile(db_session, subj.id, "Limit", 40)
        db_session.commit()

        plan = generate_daily_plan(db_session, free_minutes=60, subject_id=subj.id)
        remedial = [i for i in plan["items"] if i["source"] == "mastery"]
        assert len(remedial) == 1
        assert remedial[0]["topic"] == "Limit"
        assert "40%" in remedial[0]["reason"]
        assert remedial[0]["type"] in ("micro_quiz", "socratic")

    def test_no_weak_topics(self, db_session, make_subject):
        subj = make_subject()
        plan = generate_daily_plan(db_session, free_minutes=60, subject_id=subj.id)
        assert all(i["source"] != "mastery" for i in plan["items"])


class TestAllocation:
    def test_total_never_exceeds_free_minutes(self, db_session, make_subject):
        subj = make_subject()
        _weak_profile(db_session, subj.id, "Limit", 40)
        for i in range(50):
            _card(db_session, subj.id, due=True)
        db_session.commit()

        plan = generate_daily_plan(db_session, free_minutes=30, subject_id=subj.id)
        assert plan["total_duration_minutes"] <= 30

    def test_prioritas_flashcard_dulu(self, db_session, make_subject):
        subj = make_subject()
        _weak_profile(db_session, subj.id, "Limit", 40)
        for i in range(10):
            _card(db_session, subj.id, due=True)
        db_session.commit()

        plan = generate_daily_plan(db_session, free_minutes=60, subject_id=subj.id)
        assert plan["items"][0]["type"] == "flashcard"
        assert plan["items"][0]["source"] == "fsrs"

    def test_empty_when_no_data(self, db_session, make_subject):
        subj = make_subject()
        plan = generate_daily_plan(db_session, free_minutes=60, subject_id=subj.id)
        assert plan["items"] == []
        assert plan["empty_reason"]


class TestEndpoint:
    def test_valid(self, db_session, make_subject):
        subj = make_subject()
        for i in range(5):
            _card(db_session, subj.id, due=True)
        db_session.commit()

        response = asyncio.run(study_daily_plan(subject_id=subj.id, free_minutes=45, db=db_session))
        body = json.loads(response.body.decode("utf-8"))
        assert body["free_minutes"] == 45
        assert len(body["items"]) == 1
        assert body["items"][0]["type"] == "flashcard"
        assert body["generated_for"]

    def test_subject_not_found(self, db_session):
        response = asyncio.run(study_daily_plan(subject_id=9999, free_minutes=60, db=db_session))
        assert response.status_code == 404

    def test_best_hour_passthrough(self, db_session, make_subject):
        subj = make_subject()
        _card(db_session, subj.id, due=True)
        db_session.add(models.Quiz(
            subject_id=subj.id, title="q", score=90,
            created_at=datetime.datetime(2026, 8, 1, 7, 0),
        ))
        db_session.commit()

        response = asyncio.run(study_daily_plan(subject_id=subj.id, free_minutes=60, db=db_session))
        body = json.loads(response.body.decode("utf-8"))
        assert body["best_hour"] is not None