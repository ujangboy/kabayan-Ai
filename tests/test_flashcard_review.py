"""
Test untuk GET /api/flashcards/review/due — antrian review SRS.

Bug yang diperbaiki: kartu baru (times_seen == 0) dan kartu dengan
next_review NULL (manual/legacy) tidak pernah muncul di antrian review
karena query lama hanya mengambil next_review <= sekarang.

Menggunakan TestClient dengan dependency_overrides agar memakai session
temporer dari fixture db_session (tidak menyentuh DB produksi).
"""
import datetime
from app.time_utils import utcnow

import pytest

from app import models
from app.database import get_db


@pytest.fixture()
def client(db_session):
    from fastapi.testclient import TestClient
    from app.main import app
    app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(app)
    app.dependency_overrides.clear()


class TestReviewDueQueue:
    def _make_flashcard(self, db_session, subject_id, **kwargs):
        fc = models.Flashcard(subject_id=subject_id, question="q", answer="a", **kwargs)
        db_session.add(fc)
        db_session.commit()
        db_session.refresh(fc)
        return fc

    def test_kartu_baru_muncul_di_antrian(self, client, db_session, make_subject):
        """Kartu baru (times_seen=0, next_review di masa depan) wajib muncul."""
        subject = make_subject()
        now = utcnow()
        # Kartu AI baru: belum pernah direview, next_review besok
        self._make_flashcard(db_session, subject.id, times_seen=0,
                             next_review=now + datetime.timedelta(days=1))

        resp = client.get("/api/flashcards/review/due")
        assert resp.status_code == 200
        data = resp.json()
        assert data["due_count"] == 1
        assert len(data["flashcards"]) == 1

    def test_kartu_next_review_null_muncul(self, client, db_session, make_subject):
        """Kartu manual/legacy (next_review NULL) wajib muncul."""
        subject = make_subject()
        self._make_flashcard(db_session, subject.id, times_seen=0, next_review=None)

        resp = client.get("/api/flashcards/review/due")
        assert resp.status_code == 200
        assert resp.json()["due_count"] == 1

    def test_kartu_sudah_review_dan_belum_due_tidak_muncul(self, client, db_session, make_subject):
        """Kartu yang sudah direview & dijadwalkan besok tidak muncul sekarang."""
        subject = make_subject()
        now = utcnow()
        self._make_flashcard(db_session, subject.id, times_seen=2,
                             next_review=now + datetime.timedelta(days=5))

        resp = client.get("/api/flashcards/review/due")
        assert resp.json()["due_count"] == 0

    def test_kartu_due_muncul(self, client, db_session, make_subject):
        """Kartu yang sudah jatuh tempo (next_review di masa lalu) tetap muncul."""
        subject = make_subject()
        now = utcnow()
        self._make_flashcard(db_session, subject.id, times_seen=3,
                             next_review=now - datetime.timedelta(days=1))

        resp = client.get("/api/flashcards/review/due")
        assert resp.json()["due_count"] == 1

    def test_kartu_mastered_dikecualikan(self, client, db_session, make_subject):
        """Kartu yang sudah dikuasai tidak masuk antrian review."""
        subject = make_subject()
        self._make_flashcard(db_session, subject.id, times_seen=0, mastered=1)

        resp = client.get("/api/flashcards/review/due")
        assert resp.json()["due_count"] == 0

    def test_filter_subject(self, client, db_session, make_subject):
        """Filter subject_id hanya mengembalikan kartu milik subject tsb."""
        subj_a = make_subject("Matematika")
        subj_b = make_subject("Fisika")
        now = utcnow()
        self._make_flashcard(db_session, subj_a.id, times_seen=0,
                             next_review=now + datetime.timedelta(days=1))
        self._make_flashcard(db_session, subj_b.id, times_seen=0,
                             next_review=now + datetime.timedelta(days=1))

        resp = client.get("/api/flashcards/review/due", params={"subject_id": subj_a.id})
        data = resp.json()
        assert data["due_count"] == 1
        assert data["flashcards"][0]["subject_id"] == subj_a.id


class TestReviewHistory:
    """Test untuk GET /api/flashcards/reviews — riwayat review per kartu."""

    def _make_flashcard(self, db_session, subject_id, **kwargs):
        fc = models.Flashcard(subject_id=subject_id, question="q", answer="a", **kwargs)
        db_session.add(fc)
        db_session.commit()
        db_session.refresh(fc)
        return fc

    def test_riwayat_kosong_untuk_kartu_baru(self, client, db_session, make_subject):
        """Kartu yang belum pernah direview → reviews kosong."""
        subject = make_subject()
        fc = self._make_flashcard(db_session, subject.id)

        resp = client.get("/api/flashcards/reviews", params={"card_ids": str(fc.id)})
        assert resp.status_code == 200
        assert resp.json()["reviews"] == {}

    def test_riwayat_terkumpul_per_kartu(self, client, db_session, make_subject):
        """Beberapa review untuk kartu yang sama terkelompok dan terurut."""
        subject = make_subject()
        fc = self._make_flashcard(db_session, subject.id)
        now = utcnow()
        for rating in (0, 2, 3):
            review = models.FlashcardReview(
                flashcard_id=fc.id,
                rating=rating,
                reviewed_at=now,
                next_review=now + datetime.timedelta(days=1),
            )
            db_session.add(review)
        db_session.commit()

        resp = client.get("/api/flashcards/reviews", params={"card_ids": str(fc.id)})
        data = resp.json()
        rows = data["reviews"].get(str(fc.id))
        assert len(rows) == 3
        assert [r["rating"] for r in rows] == [0, 2, 3]

    def test_multiple_kartu_terpisah(self, client, db_session, make_subject):
        """Review dari dua kartu berbeda tidak tercampur."""
        subject = make_subject()
        fc1 = self._make_flashcard(db_session, subject.id)
        fc2 = self._make_flashcard(db_session, subject.id)
        now = utcnow()
        for fid in (fc1.id, fc2.id):
            db_session.add(models.FlashcardReview(
                flashcard_id=fid, rating=2,
                reviewed_at=now, next_review=now + datetime.timedelta(days=2),
            ))
        db_session.commit()

        resp = client.get("/api/flashcards/reviews", params={"card_ids": f"{fc1.id},{fc2.id}"})
        data = resp.json()["reviews"]
        assert len(data[str(fc1.id)]) == 1
        assert len(data[str(fc2.id)]) == 1

    def test_card_ids_invalid_abaikan(self, client, db_session, make_subject):
        """ID non-numerik diabaikan tanpa error."""
        subject = make_subject()
        fc = self._make_flashcard(db_session, subject.id)
        db_session.add(models.FlashcardReview(
            flashcard_id=fc.id, rating=2,
            reviewed_at=utcnow(),
            next_review=utcnow() + datetime.timedelta(days=1),
        ))
        db_session.commit()

        resp = client.get("/api/flashcards/reviews", params={"card_ids": "abc,,xyz"})
        assert resp.status_code == 200
        assert resp.json()["reviews"] == {}

        resp = client.get("/api/flashcards/reviews", params={"card_ids": f"{fc.id},abc"})
        assert resp.status_code == 200
        assert len(resp.json()["reviews"]) == 1
