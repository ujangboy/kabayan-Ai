"""
Test Progress Tracking (engines/progress.py + GET /api/study/progress) — PRD US5.1.

Fokus uji:
  - Streak dari kuis/ujian/review flashcard pada hari berturut-turut
  - Grace 1 hari: streak bertahan bila hari ini belum belajar
  - Streak terputus bila jeda >= 2 hari; rekor (longest) dihitung benar
  - Filter per subject
  - Tren mastery dari topic_trend_json (agregasi lintas topik per sesi + arah)
  - Endpoint: 200 valid, 404 subject hilang
"""
import datetime
from app.time_utils import utcnow
import json

import pytest

from app import models
from app.database import get_db
from app.engines.progress import compute_streak, compute_mastery_trend, get_progress, _local_date


@pytest.fixture()
def client(db_session):
    from fastapi.testclient import TestClient
    from app.main import app

    app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(app)
    app.dependency_overrides.clear()


def _quiz(db, subject_id, days_ago, score=80):
    db.add(models.Quiz(
        subject_id=subject_id, title="q", score=score,
        created_at=utcnow() - datetime.timedelta(days=days_ago),
    ))
    db.commit()


def _profile(db, subject_id, trend):
    db.add(models.LearningProfile(
        user_key="local", subject_id=subject_id,
        topics_mastery="{}", weak_topics="[]", strong_topics="[]",
        total_sessions=0, total_questions=0, total_correct=0,
        topic_trend_json=json.dumps(trend),
    ))
    db.commit()


class TestStreak:
    def test_empty_has_zero_streak(self, db_session, make_subject):
        subj = make_subject()
        s = compute_streak(db_session, subj.id)
        assert s["current_streak_days"] == 0
        assert s["longest_streak_days"] == 0
        assert s["total_active_days"] == 0
        assert s["last_active_date"] is None
        assert len(s["activity_last_14_days"]) == 14
        assert all(not d["active"] for d in s["activity_last_14_days"])

    def test_three_consecutive_days(self, db_session, make_subject):
        subj = make_subject()
        for i in range(3):
            _quiz(db_session, subj.id, i)
        s = compute_streak(db_session, subj.id)
        assert s["current_streak_days"] == 3
        assert s["longest_streak_days"] == 3
        assert s["total_active_days"] == 3

    def test_streak_survives_today_grace(self, db_session, make_subject):
        """Aktivitas kemarin-lusa-hari ini belum → streak tetap terhitung."""
        subj = make_subject()
        _quiz(db_session, subj.id, 1)
        _quiz(db_session, subj.id, 2)
        s = compute_streak(db_session, subj.id)
        assert s["current_streak_days"] == 2

    def test_streak_breaks_on_gap(self, db_session, make_subject):
        subj = make_subject()
        _quiz(db_session, subj.id, 0)
        _quiz(db_session, subj.id, 3)
        s = compute_streak(db_session, subj.id)
        assert s["current_streak_days"] == 1
        assert s["longest_streak_days"] == 1

    def test_longest_over_two_runs(self, db_session, make_subject):
        subj = make_subject()
        for i in (0, 1, 2, 5, 6):  # run 3 hari + run 2 hari (jeda di hari 3,4)
            _quiz(db_session, subj.id, i)
        s = compute_streak(db_session, subj.id)
        assert s["current_streak_days"] == 3
        assert s["longest_streak_days"] == 3
        assert s["total_active_days"] == 5

    def test_subject_filter(self, db_session, make_subject):
        a, b = make_subject("A"), make_subject("B")
        for i in range(4):
            _quiz(db_session, a.id, i)
        _quiz(db_session, b.id, 0)
        assert compute_streak(db_session, a.id)["current_streak_days"] == 4
        assert compute_streak(db_session, b.id)["current_streak_days"] == 1
        assert compute_streak(db_session, None)["current_streak_days"] == 4

    def test_window_flags_today(self, db_session, make_subject):
        subj = make_subject()
        _quiz(db_session, subj.id, 0)
        window = compute_streak(db_session, subj.id)["activity_last_14_days"]
        today = _local_date(utcnow()).isoformat()
        assert window[-1]["date"] == today
        assert window[-1]["active"] is True


class TestMasteryTrend:
    def test_empty(self, db_session, make_subject):
        subj = make_subject()
        t = compute_mastery_trend(db_session, subj.id)
        assert t["series"] == []
        assert t["direction"] is None
        assert t["last_session_avg"] is None

    def test_aggregates_across_topics(self, db_session, make_subject):
        subj = make_subject()
        _profile(db_session, subj.id, {"A": [60, 70, 80], "B": [50, 40]})
        t = compute_mastery_trend(db_session, subj.id)
        assert len(t["series"]) == 3
        assert t["series"][0] == {"session": 1, "avg_accuracy": 55.0, "topics_measured": 2}
        assert t["series"][1] == {"session": 2, "avg_accuracy": 55.0, "topics_measured": 2}
        assert t["series"][2] == {"session": 3, "avg_accuracy": 80.0, "topics_measured": 1}
        assert t["direction"] == "naik"
        assert t["last_session_avg"] == 80.0

    def test_direction_down_and_stable(self, db_session, make_subject):
        down, stable = make_subject("Down"), make_subject("Stable")
        _profile(db_session, down.id, {"T": [80, 70, 60]})
        _profile(db_session, stable.id, {"T": [70, 71, 69]})
        assert compute_mastery_trend(db_session, down.id)["direction"] == "turun"
        assert compute_mastery_trend(db_session, stable.id)["direction"] == "stabil"

    def test_latest_profile_wins(self, db_session, make_subject):
        subj = make_subject()
        _profile(db_session, subj.id, {"A": [50]})
        profile = db_session.query(models.LearningProfile).first()
        profile.topic_trend_json = json.dumps({"A": [90, 95]})
        db_session.commit()
        t = compute_mastery_trend(db_session, subj.id)
        assert t["series"][0]["avg_accuracy"] == 90.0


class TestProgressEndpoint:
    def test_returns_full_payload(self, db_session, make_subject):
        subj = make_subject()
        _quiz(db_session, subj.id, 0)
        _profile(db_session, subj.id, {"A": [60, 75]})
        payload = get_progress(db_session, subj.id)
        assert set(payload.keys()) == {"subject_id", "streak", "mastery_trend"}
        assert payload["streak"]["current_streak_days"] == 1
        assert payload["mastery_trend"]["direction"] == "naik"

    def test_endpoint_200_and_404(self, db_session, make_subject, client):
        subj = make_subject()
        _quiz(db_session, subj.id, 0)
        res = client.get(f"/api/study/progress?subject_id={subj.id}")
        assert res.status_code == 200
        data = res.json()
        assert "streak" in data and "mastery_trend" in data
        res = client.get("/api/study/progress?subject_id=99999")
        assert res.status_code == 404