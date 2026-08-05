"""
Test untuk GET /api/flashcards/review/due — antrian review SRS.

Bug yang diperbaiki: kartu baru (times_seen == 0) dan kartu dengan
next_review NULL (manual/legacy) tidak pernah muncul di antrian review
karena query lama hanya mengambil next_review <= sekarang.

Menggunakan TestClient dengan dependency_overrides agar memakai session
temporer dari fixture db_session (tidak menyentuh DB produksi).
"""
import datetime

import pytest

import models
from database import get_db


@pytest.fixture()
def client(db_session):
    from fastapi.testclient import TestClient
    from main import app
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
        now = datetime.datetime.utcnow()
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
        now = datetime.datetime.utcnow()
        self._make_flashcard(db_session, subject.id, times_seen=2,
                             next_review=now + datetime.timedelta(days=5))

        resp = client.get("/api/flashcards/review/due")
        assert resp.json()["due_count"] == 0

    def test_kartu_due_muncul(self, client, db_session, make_subject):
        """Kartu yang sudah jatuh tempo (next_review di masa lalu) tetap muncul."""
        subject = make_subject()
        now = datetime.datetime.utcnow()
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
        now = datetime.datetime.utcnow()
        self._make_flashcard(db_session, subj_a.id, times_seen=0,
                             next_review=now + datetime.timedelta(days=1))
        self._make_flashcard(db_session, subj_b.id, times_seen=0,
                             next_review=now + datetime.timedelta(days=1))

        resp = client.get("/api/flashcards/review/due", params={"subject_id": subj_a.id})
        data = resp.json()
        assert data["due_count"] == 1
        assert data["flashcards"][0]["subject_id"] == subj_a.id
