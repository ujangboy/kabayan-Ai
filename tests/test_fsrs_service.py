"""
Test FSRS Service (services/fsrs_service.py) — PRD US3.1.

Fokus uji:
  - Mapping rating UI 0..4 → FSRS (Again/Hard/Good/Easy)
  - Kartu baru (tanpa fsrs_state) → review pertama membentuk state
  - fsrs_state tersimpan & bisa dibaca ulang (persistensi)
  - Kartu dikuasai (interval >= 21 hari) → mastered=1
  - Rating Lupa (0/1) → rerun=True, interval pendek
  - apply_review (endpoint-level) menyimpan FlashcardReview
  - Backward compat: kartu legacy (hanya field SRS lama) tetap berfungsi
"""
import datetime
import json

import pytest

import models
from services.fsrs_service import (
    build_card,
    review,
    apply_review,
    _RATING_MAP,
)
from fsrs import Rating as FSRating


def _make_flashcard(db, subject_id, **kwargs):
    fc = models.Flashcard(subject_id=subject_id, question="q", answer="a", **kwargs)
    db.add(fc)
    db.commit()
    db.refresh(fc)
    return fc


class TestRatingMapping:
    def test_ui_rating_maps_to_fsrs(self):
        assert _RATING_MAP[0] == FSRating.Again
        assert _RATING_MAP[1] == FSRating.Hard
        assert _RATING_MAP[2] == FSRating.Good
        assert _RATING_MAP[3] == FSRating.Easy
        assert _RATING_MAP[4] == FSRating.Easy


class TestReviewLogic:
    def test_new_card_review_again_reruns(self, db_session, make_subject):
        subject = make_subject()
        fc = _make_flashcard(db_session, subject.id)

        result = review(fc, 0)

        assert result["rerun"] is True
        assert result["interval_days"] <= 1
        assert result["next_review_iso"] is not None
        assert result["fsrs_state"]  # state JSON tersimpan

    def test_new_card_review_good_forms_state(self, db_session, make_subject):
        subject = make_subject()
        fc = _make_flashcard(db_session, subject.id)

        result = review(fc, 2)
        data = json.loads(result["fsrs_state"])
        assert data.get("stability") is not None
        assert data.get("difficulty") is not None
        assert data.get("last_review") is not None

    def test_state_persists_and_reloads(self, db_session, make_subject):
        subject = make_subject()
        fc = _make_flashcard(db_session, subject.id)
        result = review(fc, 3)
        fc.fsrs_state = result["fsrs_state"]
        db_session.commit()

        card = build_card(fc)
        assert round(card.stability, 3) == result["stability_days"]
        assert round(card.difficulty, 3) == result["difficulty"]

    def test_easy_ratings_grow_interval(self, db_session, make_subject):
        subject = make_subject()
        fc = _make_flashcard(db_session, subject.id)
        r1 = review(fc, 4)
        fc.fsrs_state = r1["fsrs_state"]
        fc.interval = r1["interval"]
        db_session.commit()

        r2 = review(fc, 4)
        assert r2["interval_days"] >= r1["interval_days"]
        assert r2["rerun"] is False

    def test_mastered_after_long_interval(self, db_session, make_subject):
        """Interval >= 21 hari → mastered=1 (FSRS state Review)."""
        subject = make_subject()
        fc = _make_flashcard(db_session, subject.id)
        now = datetime.datetime.now(datetime.timezone.utc)
        # Review berulang dengan Easy di waktu maju sampai interval panjang
        for i in range(12):
            now = now + datetime.timedelta(days=max(1, i * 2))
            result = review(fc, 4, now=now)
            fc.fsrs_state = result["fsrs_state"]
            fc.interval = result["interval"]
            db_session.commit()
            if result["mastered_flag"]:
                break
        assert result["mastered_flag"] == 1
        assert result["interval_days"] >= 21

    def test_legacy_card_backward_compat(self, db_session, make_subject):
        """Kartu lama (interval 5, ease 250, tanpa fsrs_state) tetap bisa direview."""
        subject = make_subject()
        past = datetime.datetime.utcnow() - datetime.timedelta(days=5)
        fc = _make_flashcard(
            db_session, subject.id,
            interval=5, ease_factor=250, times_seen=3,
            last_reviewed=past,
            next_review=datetime.datetime.utcnow() + datetime.timedelta(days=1),
        )
        result = review(fc, 2)
        assert result["interval_days"] >= 1
        assert result["fsrs_state"] is not None


class TestApplyReviewEndpoint:
    def test_apply_review_saves_review_row(self, db_session, make_subject):
        subject = make_subject()
        fc = _make_flashcard(db_session, subject.id)

        payload = apply_review(db_session, fc, 2, response_time_ms=1234)

        assert payload["interval_days"] >= 1
        assert payload["rerun"] is False
        assert payload["fsrs"]["state"] in ("Learning", "Review", "Relearning")
        assert fc.times_seen == 1
        assert fc.fsrs_state is not None
        assert fc.next_review is not None

        row = db_session.query(models.FlashcardReview).filter_by(flashcard_id=fc.id).first()
        assert row is not None
        assert row.rating == 2
        assert row.response_time_ms == 1234

    def test_apply_review_rating_out_of_range_falls_back_good(self, db_session, make_subject):
        subject = make_subject()
        fc = _make_flashcard(db_session, subject.id)
        payload = apply_review(db_session, fc, 9)
        assert payload["interval_days"] >= 1


def test_rerun_ratings_flag(db_session, make_subject):
    subject = make_subject()
    fc = _make_flashcard(db_session, subject.id)
    for rating in (0, 1):
        fc2 = _make_flashcard(db_session, subject.id)
        result = review(fc2, rating)
        assert result["rerun"] is True
    for rating in (2, 3, 4):
        fc3 = _make_flashcard(db_session, subject.id)
        result = review(fc3, rating)
        assert result["rerun"] is False
