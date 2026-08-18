"""
Progress Tracking Engine (PRD US5.1) — konsistensi belajar + tren mastery.

Dua metrik yang belum tersedia di dashboard:
  - streak          : rangkaian hari belajar berturut-turut (hari lokal
                      Asia/Jakarta), panjang rekor, total hari aktif, dan
                      peta aktivitas 14 hari terakhir untuk mini-calendar.
  - mastery_trend   : tren penguasaan per sesi latihan, diagregasi dari
                      LearningProfile.topic_trend_json — arah (naik/turun/
                      stabil) untuk mendeteksi kemajuan lintas waktu.

Stateless, murni Python, real-time dari data tersimpan — tanpa schema baru.
Aktivitas belajar yang dihitung: kuis ber-skor, sesi ujian ter-submit, dan
review flashcard.
"""
from __future__ import annotations

import datetime
from time_utils import utcnow
import json
import logging
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

TREND_SHIFT_THRESHOLD = 3   # selisih akurasi >=3 → dianggap berubah arah
STREAK_GRACE_DAYS = 1       # streak bertahan bila hari ini belum belajar
ACTIVITY_WINDOW_DAYS = 14   # jendela peta aktivitas


def _local_date(dt: Optional[datetime.datetime]) -> Optional[datetime.date]:
    """Tanggal lokal (Asia/Jakarta); naive datetime dianggap UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        return dt.astimezone(ZoneInfo("Asia/Jakarta")).date()
    except Exception:
        return dt.date()


def _load_json(text: Optional[str], fallback):
    if not text:
        return fallback
    try:
        data = json.loads(text)
        return data if data is not None else fallback
    except (json.JSONDecodeError, TypeError):
        return fallback


# ─── Aktivitas ────────────────────────────────────────────────────────────────

def _activity_dates(db: Session, subject_id: Optional[int]) -> List[datetime.date]:
    """Tanggal-tanggal (lokal) di mana pengguna belajar aktif."""
    import models

    dates: List[datetime.date] = []

    quizzes = db.query(models.Quiz).filter(models.Quiz.score.isnot(None))
    exams = db.query(models.ExamSession).filter(models.ExamSession.submitted_at.isnot(None))
    reviews = (
        db.query(models.FlashcardReview)
        .join(models.Flashcard, models.FlashcardReview.flashcard_id == models.Flashcard.id)
        .filter(models.FlashcardReview.reviewed_at.isnot(None))
    )
    if subject_id is not None:
        quizzes = quizzes.filter(models.Quiz.subject_id == subject_id)
        exams = exams.filter(models.ExamSession.subject_id == subject_id)
        reviews = reviews.filter(models.Flashcard.subject_id == subject_id)

    for q in quizzes.all():
        d = _local_date(q.created_at)
        if d is not None:
            dates.append(d)
    for e in exams.all():
        d = _local_date(e.submitted_at)
        if d is not None:
            dates.append(d)
    for r in reviews.all():
        d = _local_date(r.reviewed_at)
        if d is not None:
            dates.append(d)

    return dates


# ─── Streak ───────────────────────────────────────────────────────────────────

def compute_streak(db: Session, subject_id: Optional[int] = None) -> Dict:
    """Streak hari belajar berturut-turut + statistik konsistensi."""
    today = _local_date(utcnow())
    date_set = set(_activity_dates(db, subject_id))
    dates = sorted(date_set)

    current = 0
    cursor = today
    if today not in date_set:
        cursor = today - datetime.timedelta(days=STREAK_GRACE_DAYS)
    while cursor in date_set:
        current += 1
        cursor -= datetime.timedelta(days=1)

    longest, run, prev = 0, 0, None
    for d in dates:
        run = run + 1 if prev is not None and (d - prev).days == 1 else 1
        longest = max(longest, run)
        prev = d

    last_active = dates[-1] if dates else None

    window = []
    for i in range(ACTIVITY_WINDOW_DAYS - 1, -1, -1):
        d = today - datetime.timedelta(days=i)
        window.append({"date": d.isoformat(), "active": d in date_set})

    return {
        "current_streak_days": current,
        "longest_streak_days": longest,
        "total_active_days": len(dates),
        "last_active_date": last_active.isoformat() if last_active else None,
        "activity_last_14_days": window,
    }


# ─── Tren Mastery ─────────────────────────────────────────────────────────────

def compute_mastery_trend(db: Session, subject_id: Optional[int] = None) -> Dict:
    """Tren penguasaan per sesi dari LearningProfile terbaru."""
    import models

    query = db.query(models.LearningProfile).order_by(models.LearningProfile.id.desc())
    if subject_id is not None:
        query = query.filter(models.LearningProfile.subject_id == subject_id)
    profile = query.first()

    trend = _load_json(profile.topic_trend_json, {}) if profile else {}
    series = []
    if isinstance(trend, dict) and trend:
        max_len = max(
            (len(v) for v in trend.values() if isinstance(v, list)),
            default=0,
        )
        for i in range(max_len):
            values = [
                v[i] for v in trend.values()
                if isinstance(v, list) and i < len(v) and isinstance(v[i], (int, float))
            ]
            if not values:
                continue
            series.append({
                "session": i + 1,
                "avg_accuracy": round(sum(values) / len(values), 1),
                "topics_measured": len(values),
            })

    direction = None
    if len(series) >= 2:
        shift = series[-1]["avg_accuracy"] - series[0]["avg_accuracy"]
        if shift >= TREND_SHIFT_THRESHOLD:
            direction = "naik"
        elif shift <= -TREND_SHIFT_THRESHOLD:
            direction = "turun"
        else:
            direction = "stabil"

    return {
        "series": series,
        "direction": direction,
        "last_session_avg": series[-1]["avg_accuracy"] if series else None,
        "total_sessions": (profile.total_sessions if profile else 0) or 0,
    }


# ─── Payload gabungan ─────────────────────────────────────────────────────────

def get_progress(db: Session, subject_id: Optional[int] = None) -> Dict:
    return {
        "subject_id": subject_id,
        "streak": compute_streak(db, subject_id),
        "mastery_trend": compute_mastery_trend(db, subject_id),
    }
