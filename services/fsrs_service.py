"""
FSRS Service — Spaced Repetition berbasis FSRS (library `fsrs`).

Menggantikan SM-2 sederhana dengan FSRS v6.3:
  - State kartu disimpan sebagai JSON di kolom `Flashcard.fsrs_state`
    (hasil `Card.to_dict()` / dibaca via `Card.from_dict`).
  - Rating UI 0..4 dipetakan ke fsrs.Rating:
      0 (Lupa) → Again, 1 (Sulit) → Hard, 2 (Biasa) → Good,
      3 (Mudah) → Easy, 4 (Sempurna) → Easy
  - Field legacy (interval, next_review, ease_factor, mastered, dll) tetap
    disinkronkan agar endpoint & UI lama tidak berubah kontraknya.
  - Backward compatibility: kartu tanpa fsrs_state dibangun dari field SRS
    lama (perkiraan stability dari interval, difficulty dari ease_factor).

Catatan fsrs API: datetime WAJIB timezone-aware UTC.
"""
from __future__ import annotations

import datetime
from time_utils import utcnow
import json
import logging
from typing import Dict, Optional

from fsrs import Card, Scheduler, Rating as FSRating, State as FSRSState

logger = logging.getLogger(__name__)

_scheduler = Scheduler()

# Rating UI (0=Lupa,1=Sulit,2=Biasa,3=Mudah,4=Sempurna) → FSRS
_RATING_MAP = {
    0: FSRating.Again,
    1: FSRating.Hard,
    2: FSRating.Good,
    3: FSRating.Easy,
    4: FSRating.Easy,
}

# Kurang dari ini dianggap "Lupa" (rerun sesi yang sama)
RERUN_RATINGS = {0, 1}


def _now_utc_aware() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def _to_naive(dt: datetime.datetime) -> Optional[datetime.datetime]:
    if dt is None:
        return None
    return dt.replace(tzinfo=None)


def _from_naive(dt: datetime.datetime) -> Optional[datetime.datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.timezone.utc)
    return dt


def build_card(flashcard) -> Card:
    """Bangun fsrs.Card dari flashcard (fsrs_state JSON atau legacy SRS)."""
    raw = getattr(flashcard, "fsrs_state", None)
    if raw:
        try:
            return Card.from_dict(json.loads(raw))
        except Exception as exc:
            logger.warning("fsrs_state korup (id=%s), rebuild legacy: %s",
                           getattr(flashcard, "id", "?"), exc)

    # ── Legacy: bangun dari field SRS lama ──
    interval = max(1, getattr(flashcard, "interval", None) or 1)
    ease = getattr(flashcard, "ease_factor", None) or 250
    last_reviewed = _from_naive(getattr(flashcard, "last_reviewed", None))
    next_review = _from_naive(getattr(flashcard, "next_review", None))
    mastered = getattr(flashcard, "mastered", 0) or 0

    card = Card()
    try:
        card.card_id = int(getattr(flashcard, "id", 0))
    except Exception:
        pass
    # stability ≈ interval legacy (hari), difficulty ≈ turunan ease_factor
    card.stability = float(interval)
    card.difficulty = max(1.0, min(10.0, 10.0 - (ease - 130) / 30.0))
    if last_reviewed:
        card.last_review = last_reviewed
    if next_review:
        card.due = next_review
    if mastered or interval >= 21:
        card.state = FSRSState.Review
    elif card.last_review:
        card.state = FSRSState.Review
    else:
        card.state = FSRSState.Learning
    return card


def review(flashcard, rating: int, now: Optional[datetime.datetime] = None) -> Dict:
    """Proses review FSRS; kembalikan dict ringkas untuk persistensi & respons.

    Wajib dipanggil setelah `rating` divalidasi (0..4).
    """
    fsrs_rating = _RATING_MAP.get(int(rating), FSRating.Good)
    if now is None:
        now = _now_utc_aware()

    card = build_card(flashcard)
    if card.last_review is None:
        # Kartu baru: baseline last_review = sekarang agar due masuk akal
        card.last_review = now

    new_card, _log = _scheduler.review_card(card, fsrs_rating, now)

    interval_days = max(1, round((new_card.due - now).total_seconds() / 86400))
    next_review = _to_naive(new_card.due)
    mastered = int(interval_days >= 21)

    result = {
        "fsrs_state": json.dumps(new_card.to_dict()),
        "interval": interval_days,
        "next_review": next_review,
        "ease_factor": int(round(max(130.0, min(400.0, (10.0 - (new_card.difficulty or 6.5)) * 30.0 + 130.0)))),
        "times_seen": (flashcard.times_seen or 0) + 1,
        "times_correct": (flashcard.times_correct or 0) + (1 if rating >= 2 else 0),
        "last_reviewed": utcnow(),
        "mastered": mastered,
        # ── Metadata respons ──
        "interval_days": interval_days,
        "next_review_iso": next_review.isoformat() if next_review else None,
        "mastered_flag": mastered,
        "rerun": int(rating) in RERUN_RATINGS,
        "stability_days": round(float(new_card.stability or 0), 3),
        "difficulty": round(float(new_card.difficulty or 0), 3),
        "fsrs_state_name": str(new_card.state.name),
    }
    return result


def apply_review(db, flashcard, rating: int, response_time_ms: int = None) -> Dict:
    """Satu entri review: hitung FSRS, simpan di Flashcard + FlashcardReview.

    Kembalikan payload yang sama kontraknya dengan versi SM-2 lama
    (interval_days, next_review, mastered, rerun) + info FSRS.
    """
    import models

    result = review(flashcard, rating)
    for key in ("fsrs_state", "interval", "next_review", "ease_factor",
                "times_seen", "times_correct", "last_reviewed", "mastered"):
        setattr(flashcard, key, result[key])

    review_row = models.FlashcardReview(
        flashcard_id=flashcard.id,
        rating=int(rating),
        reviewed_at=utcnow(),
        next_review=result["next_review"],
    )
    if response_time_ms is not None:
        review_row.response_time_ms = int(response_time_ms)
    db.add(review_row)
    db.flush()

    return {
        "interval_days": result["interval_days"],
        "next_review": result["next_review_iso"],
        "mastered": result["mastered_flag"],
        "rerun": result["rerun"],
        "fsrs": {
            "stability_days": result["stability_days"],
            "difficulty": result["difficulty"],
            "state": result["fsrs_state_name"],
        },
    }


fsrs_service = None  # kompatibilitas import lama (tidak dipakai)
