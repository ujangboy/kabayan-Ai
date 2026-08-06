"""
Test Modality Router (engines/modality_router.py + routers/study.py) — PRD US3.2.

Fokus uji:
  - Mapping tier → modalitas: SIMPLE→flashcard, MEDIUM→micro_quiz, COMPLEX→socratic
  - Fallback SIMPLE tanpa flashcard → micro_quiz → socratic
  - Fallback MEDIUM tanpa quiz → socratic
  - COMPLEX selalu socratic (tidak butuh resource)
  - Hitungan resources (total/due kartu, jumlah quiz)
  - Endpoint /api/study/route: 200 valid, 422 tier invalid, 404 subject hilang
"""
import datetime
import asyncio

import pytest

import models
from engines.modality_router import route, collect_resources, MODALITY_BY_TIER
from routers.study import study_route, StudyRouteRequest


def _add_flashcards(db, subject_id, n=2, due_days=None):
    cards = []
    for i in range(n):
        fc = models.Flashcard(
            subject_id=subject_id,
            question=f"q{i}",
            answer=f"a{i}",
            interval=1,
            ease_factor=250,
        )
        if due_days is not None:
            fc.next_review = datetime.datetime.utcnow() + datetime.timedelta(days=due_days)
        db.add(fc)
        cards.append(fc)
    db.commit()
    return cards


def _add_quiz(db, subject_id, n=1):
    quizzes = []
    for i in range(n):
        q = models.Quiz(
            subject_id=subject_id,
            title=f"Quiz {i}",
            questions_json='{"mcq": [{"q": "a"}]}',
        )
        db.add(q)
        quizzes.append(q)
    db.commit()
    return quizzes


class TestTierMapping:
    def test_default_mapping(self):
        assert MODALITY_BY_TIER["SIMPLE"] == "flashcard"
        assert MODALITY_BY_TIER["MEDIUM"] == "micro_quiz"
        assert MODALITY_BY_TIER["COMPLEX"] == "socratic"


class TestResourceCollection:
    def test_counts(self, db_session, make_subject):
        subject = make_subject()
        _add_flashcards(db_session, subject.id, n=3, due_days=-1)
        _add_flashcards(db_session, subject.id, n=1, due_days=5)
        _add_quiz(db_session, subject.id, n=2)

        res = collect_resources(db_session, subject.id)
        assert res["flashcards_total"] == 4
        assert res["flashcards_due"] == 3
        assert res["quizzes_total"] == 2

    def test_empty_subject(self, db_session, make_subject):
        subject = make_subject()
        res = collect_resources(db_session, subject.id)
        assert res == {"flashcards_total": 0, "flashcards_due": 0, "quizzes_total": 0}

    def test_quiz_without_questions_not_counted(self, db_session, make_subject):
        subject = make_subject()
        db_session.add(models.Quiz(subject_id=subject.id, title="kosong"))
        db_session.commit()
        assert collect_resources(db_session, subject.id)["quizzes_total"] == 0


class TestRouting:
    def test_simple_with_flashcards(self, db_session, make_subject):
        subject = make_subject()
        _add_flashcards(db_session, subject.id)
        result = route(db_session, subject.id, "SIMPLE", topic="Limit")
        assert result["modality"] == "flashcard"
        assert result["tier"] == "SIMPLE"
        assert result["topic"] == "Limit"
        assert result["modality_label"] == "Flashcard"
        assert result["reason"]

    def test_simple_no_flashcards_with_quiz(self, db_session, make_subject):
        subject = make_subject()
        _add_quiz(db_session, subject.id)
        result = route(db_session, subject.id, "SIMPLE")
        assert result["modality"] == "micro_quiz"

    def test_simple_no_resources(self, db_session, make_subject):
        subject = make_subject()
        result = route(db_session, subject.id, "SIMPLE")
        assert result["modality"] == "socratic"

    def test_medium_with_quiz(self, db_session, make_subject):
        subject = make_subject()
        _add_quiz(db_session, subject.id)
        result = route(db_session, subject.id, "MEDIUM")
        assert result["modality"] == "micro_quiz"

    def test_medium_without_quiz(self, db_session, make_subject):
        subject = make_subject()
        _add_flashcards(db_session, subject.id)  # kartu tidak menggantikan quiz
        result = route(db_session, subject.id, "MEDIUM")
        assert result["modality"] == "socratic"

    def test_complex_always_socratic(self, db_session, make_subject):
        subject = make_subject()
        result = route(db_session, subject.id, "COMPLEX")
        assert result["modality"] == "socratic"

    def test_invalid_tier_raises(self, db_session, make_subject):
        subject = make_subject()
        with pytest.raises(ValueError):
            route(db_session, subject.id, "ULTRA")

    def test_tier_case_insensitive(self, db_session, make_subject):
        subject = make_subject()
        _add_flashcards(db_session, subject.id)
        result = route(db_session, subject.id, "simple")
        assert result["modality"] == "flashcard"


def _call(req, db):
    return asyncio.run(study_route(req, db=db))


class TestStudyRouteEndpoint:
    def test_valid_route(self, db_session, make_subject):
        subject = make_subject()
        _add_flashcards(db_session, subject.id)
        response = _call(
            StudyRouteRequest(subject_id=subject.id, tier="SIMPLE", topic="Deret"), db_session
        )
        body = response.body.decode("utf-8")
        assert '"modality":"flashcard"' in body or '"modality": "flashcard"' in body

    def test_subject_not_found(self, db_session):
        response = _call(StudyRouteRequest(subject_id=9999, tier="SIMPLE"), db_session)
        assert response.status_code == 404

    def test_invalid_tier(self, db_session, make_subject):
        subject = make_subject()
        response = _call(StudyRouteRequest(subject_id=subject.id, tier="JUMBO"), db_session)
        assert response.status_code == 422
