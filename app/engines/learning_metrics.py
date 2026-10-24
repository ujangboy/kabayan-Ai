"""
Learning Metrics Engine (PRD US3.3) — metrik perilaku belajar + overview FSRS.

Menyatukan Learning Profile Service dengan FSRS (gap Fase 3):
  - speed            : kecepatan mengerjakan soal (detik/soal, item/menit) &
                       rata-rata waktu jawab flashcard (ms). "Kecepatan baca"
                       memerlukan reading-tracker di UI (tidak ada signal baca
                       saat ini) — dikembalikan None dengan catatan.
  - fatigue          : kelelahan — proksi dari akurasi sesi panjang vs pendek
                       + streak jawaban salah berturut-turut di ujian.
  - optimal_time     : jam terbaik belajar — bucket jam (Asia/Jakarta) dari
                       sesi quiz & ujian ber-skor; jam dengan rata-rata skor
                       tertinggi = waktu belajar optimal.
  - fsrs_overview    : ringkasan state memori FSRS (due/new/mastered,
                       stabilitas, retensi) — penyatuan FSRS dengan profil.

Murni Python, idempoten, real-time dari data tersimpan — tanpa perubahan schema.
"""
from __future__ import annotations

import datetime
from app.time_utils import utcnow
import json
import logging
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

LONG_SESSION_SECONDS = 1800   # 30 menit
FATIGUE_DROP_HEAVY = 15       # penurunan akurasi >=15 → berat
FATIGUE_DROP_MEDIUM = 5       # penurunan akurasi >=5  → sedang

WPM_NOTE = (
    "Kecepatan membaca (WPM) memerlukan reading-tracker di UI; "
    "saat ini diukur kecepatan mengerjakan soal sebagai proksi."
)


def _local_hour(dt: Optional[datetime.datetime]) -> Optional[int]:
    """Konversi ke jam lokal (Asia/Jakarta); naive datetime dianggap UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        return dt.astimezone(ZoneInfo("Asia/Jakarta")).hour
    except Exception:
        return dt.hour


def _fsrs_avg(rows) -> Tuple[Optional[float], Optional[float]]:
    """Rata-rata stability/difficulty dari fsrs_state JSON tiap kartu."""
    stability, difficulty = [], []
    for r in rows:
        if not r.fsrs_state:
            continue
        try:
            data = json.loads(r.fsrs_state)
            if data.get("stability") is not None:
                stability.append(float(data["stability"]))
            if data.get("difficulty") is not None:
                difficulty.append(float(data["difficulty"]))
        except (json.JSONDecodeError, TypeError, ValueError):
            continue
    return (
        sum(stability) / len(stability) if stability else None,
        sum(difficulty) / len(difficulty) if difficulty else None,
    )


def _consecutive_wrong_streak(db: Session, subject_id: Optional[int]) -> int:
    """Streak jawaban salah berturut-turut (urutan ExamReview.id per attempt)."""
    from app import models

    reviews = (
        db.query(models.ExamReview)
        .join(models.ExamAttempt, models.ExamReview.attempt_id == models.ExamAttempt.id)
        .join(models.ExamSession, models.ExamAttempt.session_id == models.ExamSession.id)
        .order_by(models.ExamReview.id)
    )
    if subject_id is not None:
        reviews = reviews.filter(models.ExamSession.subject_id == subject_id)

    streak, best = 0, 0
    for r in reviews.all():
        if not r.is_correct:
            streak += 1
            best = max(best, streak)
        else:
            streak = 0
    return best


# ─── Speed ────────────────────────────────────────────────────────────────────

def compute_speed(db: Session, subject_id: Optional[int] = None) -> Dict:
    from app import models

    quizzes = db.query(models.Quiz).filter(
        models.Quiz.time_taken.isnot(None),
        models.Quiz.time_taken > 0,
        models.Quiz.total_questions.isnot(None),
        models.Quiz.total_questions > 0,
    )
    attempts = (
        db.query(models.ExamAttempt)
        .join(models.ExamSession, models.ExamAttempt.session_id == models.ExamSession.id)
        .filter(models.ExamAttempt.duration_seconds.isnot(None))
    )
    if subject_id is not None:
        quizzes = quizzes.filter(models.Quiz.subject_id == subject_id)
        attempts = attempts.filter(models.ExamSession.subject_id == subject_id)

    total_q, total_secs = 0, 0
    for q in quizzes.all():
        total_q += q.total_questions
        total_secs += q.time_taken
    for a in attempts.all():
        if a.duration_seconds:
            total_q += a.session.total_questions or 0
            total_secs += a.duration_seconds

    seconds_per_question = None
    if total_q > 0 and total_secs > 0:
        seconds_per_question = round(total_secs / total_q, 1)

    reviews = (
        db.query(models.FlashcardReview)
        .join(models.Flashcard, models.FlashcardReview.flashcard_id == models.Flashcard.id)
        .filter(models.FlashcardReview.response_time_ms.isnot(None))
    )
    if subject_id is not None:
        reviews = reviews.filter(models.Flashcard.subject_id == subject_id)

    response_times = [r.response_time_ms for r in reviews.all()]
    avg_response_ms = (
        int(sum(response_times) / len(response_times)) if response_times else None
    )

    return {
        "reading_speed_wpm": None,
        "reading_speed_note": WPM_NOTE,
        "seconds_per_question": seconds_per_question,
        "items_per_minute": (
            round(60 / seconds_per_question, 1) if seconds_per_question else None
        ),
        "flashcards_avg_response_ms": avg_response_ms,
    }


# ─── Fatigue ──────────────────────────────────────────────────────────────────

def compute_fatigue(db: Session, subject_id: Optional[int] = None) -> Dict:
    from app import models

    quizzes = db.query(models.Quiz).filter(
        models.Quiz.time_taken.isnot(None),
        models.Quiz.score.isnot(None),
    )
    if subject_id is not None:
        quizzes = quizzes.filter(models.Quiz.subject_id == subject_id)

    short_scores, long_scores = [], []
    short_n, long_n = 0, 0
    for q in quizzes.all():
        if (q.time_taken or 0) >= LONG_SESSION_SECONDS:
            long_scores.append(q.score)
            long_n += 1
        else:
            short_scores.append(q.score)
            short_n += 1

    short_avg = sum(short_scores) / len(short_scores) if short_scores else None
    long_avg = sum(long_scores) / len(long_scores) if long_scores else None

    accuracy_drop = None
    if short_avg is not None and long_avg is not None:
        accuracy_drop = round(max(0.0, short_avg - long_avg), 1)

    if accuracy_drop is None:
        level = "tidak_cukup_data"
    elif accuracy_drop >= FATIGUE_DROP_HEAVY:
        level = "berat"
    elif accuracy_drop >= FATIGUE_DROP_MEDIUM:
        level = "sedang"
    elif accuracy_drop > 0:
        level = "ringan"
    else:
        level = "normal"

    return {
        "sessions": short_n + long_n,
        "short_session_n": short_n,
        "long_session_n": long_n,
        "short_session_avg_score": short_avg,
        "long_session_avg_score": long_avg,
        "accuracy_drop": accuracy_drop,
        "max_consecutive_wrong": _consecutive_wrong_streak(db, subject_id),
        "level": level,
    }


# ─── Optimal Study Time ──────────────────────────────────────────────────────

def compute_optimal_time(db: Session, subject_id: Optional[int] = None) -> Dict:
    from app import models

    buckets = defaultdict(lambda: {"count": 0, "score_sum": 0.0})

    quizzes = db.query(models.Quiz).filter(
        models.Quiz.score.isnot(None),
        models.Quiz.created_at.isnot(None),
    )
    exams = db.query(models.ExamSession).filter(
        models.ExamSession.submitted_at.isnot(None),
        models.ExamSession.score.isnot(None),
    )
    if subject_id is not None:
        quizzes = quizzes.filter(models.Quiz.subject_id == subject_id)
        exams = exams.filter(models.ExamSession.subject_id == subject_id)

    for q in quizzes.all():
        hour = _local_hour(q.created_at)
        if hour is not None:
            buckets[hour]["count"] += 1
            buckets[hour]["score_sum"] += q.score
    for e in exams.all():
        hour = _local_hour(e.submitted_at)
        if hour is not None:
            buckets[hour]["count"] += 1
            buckets[hour]["score_sum"] += (e.score or 0)

    activity_by_hour = {}
    for hour, b in buckets.items():
        avg = round(b["score_sum"] / b["count"], 1) if b["count"] else 0
        activity_by_hour[hour] = {"count": b["count"], "avg_score": avg}

    best_hour, best_score = None, None
    for hour, b in sorted(activity_by_hour.items()):
        if b["count"] >= 1 and (best_score is None or b["avg_score"] > best_score):
            best_hour = hour
            best_score = b["avg_score"]

    return {
        "best_hour": best_hour,
        "best_hour_avg_score": best_score,
        "activity_by_hour": activity_by_hour or None,
        "timezone": "Asia/Jakarta",
    }


# ─── FSRS Overview ────────────────────────────────────────────────────────────

def compute_fsrs_overview(db: Session, subject_id: Optional[int] = None) -> Dict:
    from app import models

    now = utcnow()
    cards = db.query(models.Flashcard)
    if subject_id is not None:
        cards = cards.filter(models.Flashcard.subject_id == subject_id)

    rows = cards.all()
    total = len(rows)
    due, new, mastered = 0, 0, 0
    retention: List[float] = []

    for r in rows:
        next_review = r.next_review
        if next_review is None or (not r.fsrs_state and (r.times_seen or 0) == 0):
            new += 1
        elif next_review <= now:
            due += 1
        if r.mastered:
            mastered += 1
        if (r.times_seen or 0) > 0:
            retention.append(min(1.0, max(0.0, (r.times_correct or 0) / r.times_seen)))

    stability_avg, difficulty_avg = _fsrs_avg(rows)

    return {
        "total_cards": total,
        "due_cards": due,
        "new_cards": new,
        "mastered_cards": mastered,
        "retention_pct": (
            round(sum(retention) / len(retention) * 100) if retention else None
        ),
        "avg_stability_days": (
            round(stability_avg, 2) if stability_avg is not None else None
        ),
        "avg_difficulty": (
            round(difficulty_avg, 2) if difficulty_avg is not None else None
        ),
    }


# ─── Payload gabungan ─────────────────────────────────────────────────────────

def get_learning_metrics(db: Session, subject_id: Optional[int] = None) -> Dict:
    return {
        "subject_id": subject_id,
        "speed": compute_speed(db, subject_id),
        "fatigue": compute_fatigue(db, subject_id),
        "optimal_time": compute_optimal_time(db, subject_id),
        "fsrs_overview": compute_fsrs_overview(db, subject_id),
    }
