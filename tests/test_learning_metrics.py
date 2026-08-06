"""
Test Learning Metrics (engines/learning_metrics.py + GET /api/study/metrics) — PRD US3.3.

Fokus uji:
  - speed: detik/soal & item/menit dari quiz+exam, rata-rata response flashcard
  - fatigue: akurasi sesi panjang vs pendek + streak salah berturut-turut
  - optimal_time: jam terbaik dari bucket skor per jam
  - fsrs_overview: due/new/mastered/retensi dari kartu + fsrs_state
  - endpoint: 200 valid, 404 subject hilang, subject filter
"""
import asyncio
import datetime
import json

import models
from engines.learning_metrics import (
    compute_speed,
    compute_fatigue,
    compute_optimal_time,
    compute_fsrs_overview,
    get_learning_metrics,
)
from routers.study import study_metrics


def _quiz(db, subject_id, score, time_taken, total_questions=10, created_at=None):
    q = models.Quiz(
        subject_id=subject_id,
        title=f"Quiz {score}",
        score=score,
        time_taken=time_taken,
        total_questions=total_questions,
        created_at=created_at or datetime.datetime.utcnow(),
    )
    db.add(q)
    return q


def _exam(db, subject_id, score, duration_seconds, submitted_at=None):
    e = models.ExamSession(
        subject_id=subject_id,
        subject_name="Matkul",
        score=score,
        total_questions=10,
        submitted_at=submitted_at or datetime.datetime.utcnow(),
        started_at=datetime.datetime.utcnow(),
        status="submitted",
    )
    db.add(e)
    db.commit()
    attempt = models.ExamAttempt(
        session_id=e.id, attempt_number=1, score=score,
        duration_seconds=duration_seconds,
    )
    db.add(attempt)
    db.commit()
    return e


def _card(db, subject_id, next_review=None, times_seen=0, times_correct=0,
          mastered=0, fsrs_state=None, interval=1):
    fc = models.Flashcard(
        subject_id=subject_id,
        question="q", answer="a",
        next_review=next_review,
        times_seen=times_seen,
        times_correct=times_correct,
        mastered=mastered,
        fsrs_state=fsrs_state,
        interval=interval,
        ease_factor=250,
    )
    db.add(fc)
    return fc


class TestSpeed:
    def test_seconds_per_question(self, db_session, make_subject):
        subject = make_subject()
        _quiz(db_session, subject.id, score=80, time_taken=600, total_questions=20)
        db_session.commit()

        result = compute_speed(db_session, subject.id)
        assert result["seconds_per_question"] == 30.0
        assert result["items_per_minute"] == 2.0
        assert result["reading_speed_wpm"] is None
        assert result["reading_speed_note"]

    def test_flashcard_response_avg(self, db_session, make_subject):
        subject = make_subject()
        fc = _card(db_session, subject.id)
        db_session.flush()
        db_session.add(models.FlashcardReview(
            flashcard_id=fc.id, rating=3, response_time_ms=1000,
        ))
        db_session.add(models.FlashcardReview(
            flashcard_id=fc.id, rating=2, response_time_ms=3000,
        ))
        db_session.commit()

        result = compute_speed(db_session, subject.id)
        assert result["flashcards_avg_response_ms"] == 2000

    def test_exam_attempt_duration(self, db_session, make_subject):
        subject = make_subject()
        _quiz(db_session, subject.id, score=80, time_taken=600, total_questions=20)
        _exam(db_session, subject.id, score=90, duration_seconds=300)  # 10 soal
        db_session.commit()

        result = compute_speed(db_session, subject.id)
        # (600 + 300) detik / 30 soal = 30 detik/soal
        assert result["seconds_per_question"] == 30.0

    def test_empty(self, db_session, make_subject):
        subject = make_subject()
        result = compute_speed(db_session, subject.id)
        assert result["seconds_per_question"] is None
        assert result["flashcards_avg_response_ms"] is None


class TestFatigue:
    def test_long_session_drop(self, db_session, make_subject):
        subject = make_subject()
        now = datetime.datetime.utcnow()
        _quiz(db_session, subject.id, score=90, time_taken=600, created_at=now)      # pendek
        _quiz(db_session, subject.id, score=40, time_taken=3600, created_at=now)     # panjang
        db_session.commit()

        result = compute_fatigue(db_session, subject.id)
        assert result["short_session_n"] == 1
        assert result["long_session_n"] == 1
        assert result["short_session_avg_score"] == 90
        assert result["long_session_avg_score"] == 40
        assert result["accuracy_drop"] == 50
        assert result["level"] == "berat"

    def test_no_long_session(self, db_session, make_subject):
        subject = make_subject()
        _quiz(db_session, subject.id, score=80, time_taken=300)
        db_session.commit()
        result = compute_fatigue(db_session, subject.id)
        assert result["level"] == "tidak_cukup_data"

    def test_consecutive_wrong_streak(self, db_session, make_subject):
        subject = make_subject()
        session = models.ExamSession(
            subject_id=subject.id, subject_name="M",
            score=50, total_questions=4,
            status="submitted", started_at=datetime.datetime.utcnow(),
            submitted_at=datetime.datetime.utcnow(),
        )
        db_session.add(session)
        db_session.commit()
        attempt = models.ExamAttempt(session_id=session.id, attempt_number=1)
        db_session.add(attempt)
        db_session.commit()
        for correct in (1, 0, 0, 0, 1):
            db_session.add(models.ExamReview(
                attempt_id=attempt.id, is_correct=correct, question_text="t",
            ))
        db_session.commit()

        result = compute_fatigue(db_session, subject.id)
        assert result["max_consecutive_wrong"] == 3


class TestOptimalTime:
    def test_best_hour(self, db_session, make_subject):
        subject = make_subject()
        morning = datetime.datetime(2026, 8, 1, 7, 0)   # 07:00 UTC → 14:00 WIB
        evening = datetime.datetime(2026, 8, 2, 2, 0)   # 02:00 UTC → 09:00 WIB
        _quiz(db_session, subject.id, score=95, time_taken=600, created_at=morning)
        _quiz(db_session, subject.id, score=55, time_taken=600, created_at=evening)
        db_session.commit()

        result = compute_optimal_time(db_session, subject.id)
        assert result["best_hour"] is not None
        assert result["best_hour_avg_score"] == 95
        assert result["activity_by_hour"][result["best_hour"]]["count"] == 1

    def test_empty(self, db_session, make_subject):
        subject = make_subject()
        result = compute_optimal_time(db_session, subject.id)
        assert result["best_hour"] is None
        assert result["activity_by_hour"] is None


class TestFsrsOverview:
    def test_counts_and_retention(self, db_session, make_subject):
        subject = make_subject()
        now = datetime.datetime.utcnow()
        fsrs_state = json.dumps({"stability": 12.5, "difficulty": 4.2})
        _card(db_session, subject.id, next_review=None)                       # new
        _card(db_session, subject.id, next_review=now - datetime.timedelta(days=1),
              times_seen=3, times_correct=2, fsrs_state=fsrs_state)           # due
        _card(db_session, subject.id, next_review=now + datetime.timedelta(days=30),
              times_seen=5, times_correct=5, mastered=1, fsrs_state=fsrs_state)  # mastered
        db_session.commit()

        result = compute_fsrs_overview(db_session, subject.id)
        assert result["total_cards"] == 3
        assert result["new_cards"] == 1
        assert result["due_cards"] == 1
        assert result["mastered_cards"] == 1
        assert result["retention_pct"] == 83   # (2/3 + 5/5)/2 = 0.833 → 83
        assert result["avg_stability_days"] == 12.5
        assert result["avg_difficulty"] == 4.2


class TestMetricsEndpoint:
    def test_valid(self, db_session, make_subject):
        subject = make_subject()
        _quiz(db_session, subject.id, score=80, time_taken=600, total_questions=20)
        db_session.commit()

        response = asyncio.run(study_metrics(subject_id=subject.id, db=db_session))
        body = json.loads(response.body.decode("utf-8"))
        assert body["speed"]["seconds_per_question"] == 30.0
        assert "fatigue" in body
        assert "optimal_time" in body
        assert "fsrs_overview" in body

    def test_subject_not_found(self, db_session):
        response = asyncio.run(study_metrics(subject_id=9999, db=db_session))
        assert response.status_code == 404

    def test_aggregate_all_subjects(self, db_session, make_subject):
        s1 = make_subject()
        s2 = make_subject()
        _quiz(db_session, s1.id, score=80, time_taken=600, total_questions=10)
        _quiz(db_session, s2.id, score=60, time_taken=1200, total_questions=10)
        db_session.commit()

        response = asyncio.run(study_metrics(subject_id=None, db=db_session))
        body = json.loads(response.body.decode("utf-8"))
        assert body["subject_id"] is None
        assert body["speed"]["seconds_per_question"] == 90.0  # 1800s / 20 soal
