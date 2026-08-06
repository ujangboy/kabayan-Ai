"""US4.2 — diagnostic: readiness, topik lemah/kuat, resep modalitas per band
mastery, no-data topics, risk flags (FSRS/kelelahan), endpoint API."""
import json

import pytest

from database import get_db
from engines.diagnostic import run_diagnostic, _prescribe
from models import QuestionBank, LearningProfile, Flashcard


def _seed_profile(db_session, subject, mastery, weak=None, strong=None, trends=None,
                  level=50, sessions=3, total_questions=30):
    db_session.add(LearningProfile(
        user_key="local", subject_id=subject.id,
        topics_mastery=json.dumps(mastery, ensure_ascii=False),
        weak_topics=json.dumps(weak or [], ensure_ascii=False),
        strong_topics=json.dumps(strong or [], ensure_ascii=False),
        topic_trend_json=json.dumps(trends or {}, ensure_ascii=False),
        estimated_level=level,
        total_sessions=sessions,
        total_questions=total_questions,
    ))
    db_session.commit()


def _seed_bank(db_session, subject, topics):
    for t in topics:
        db_session.add(QuestionBank(subject_id=subject.id, topic=t, chapter="Bab 1"))
    db_session.commit()


class TestPrescribe:
    def test_low_accuracy_socratic(self):
        p = _prescribe(35, "stabil")
        assert p["modality"] == "socratic"
        assert p["to"] == "/chat"

    def test_medium_accuracy_micro_quiz(self):
        p = _prescribe(55, "stabil")
        assert p["modality"] == "micro_quiz"
        assert p["to"] == "/quiz"

    def test_high_accuracy_stable_no_corrective(self):
        p = _prescribe(80, "naik")
        assert p["modality"] is None

    def test_high_accuracy_declining_flashcard(self):
        p = _prescribe(80, "turun")
        assert p["modality"] == "flashcard"
        assert p["to"] == "/flashcard"

    def test_no_data_micro_quiz(self):
        p = _prescribe(None, "stabil")
        assert p["modality"] == "micro_quiz"


class TestDiagnosticEngine:
    def test_empty_subject_cold_start(self, db_session, make_subject):
        subject = make_subject()
        result = run_diagnostic(db_session, subject.id)

        assert result["readiness"]["level"] == "belum_ada_data"
        assert result["overview"]["topics_covered"] == 0
        assert result["overview"]["coverage_pct"] == 0
        # tanpa data apa pun → resep default flashcard
        assert result["action_items"][0]["modality"] == "flashcard"

    def test_weak_topics_ranked_and_prescribed(self, db_session, make_subject):
        subject = make_subject()
        _seed_bank(db_session, subject, ["Array", "Tree", "Queue"])
        _seed_profile(db_session, subject,
                      mastery={"Array": {"accuracy": 80, "attempts": 3, "sessions": 2},
                               "Tree": {"accuracy": 30, "attempts": 2, "sessions": 1},
                               "Queue": {"accuracy": 55, "attempts": 2, "sessions": 1}},
                      weak=["Tree", "Queue"])

        result = run_diagnostic(db_session, subject.id)

        weak = {d["topic"]: d for d in result["weak_topics"]}
        assert set(weak) == {"Tree", "Queue"}
        assert weak["Tree"]["corrective"]["modality"] == "socratic"
        assert weak["Queue"]["corrective"]["modality"] == "micro_quiz"
        # urutan: Tree (30%) di atas Queue (55%)
        assert [d["topic"] for d in result["weak_topics"]] == ["Tree", "Queue"]
        # readiness: rata-rata (80+30+55)/3 = 55 → perlu banyak latihan
        assert result["readiness"]["level"] == "perlu_banyak_latihan"
        assert result["readiness"]["avg_mastery"] == 55
        # action items: 2 resep dari weak
        assert len(result["action_items"]) == 2
        assert result["action_items"][0]["topic"] == "Tree"

    def test_strong_and_no_data_topics(self, db_session, make_subject):
        subject = make_subject()
        _seed_bank(db_session, subject, ["Array", "Sorting"])
        _seed_profile(db_session, subject,
                      mastery={"Array": {"accuracy": 90, "attempts": 5, "sessions": 3}},
                      strong=["Array"])

        result = run_diagnostic(db_session, subject.id)

        assert [d["topic"] for d in result["strong_topics"]] == ["Array"]
        assert result["no_data_topics"] == ["Sorting"]
        assert result["readiness"]["level"] == "siap_ujian"
        assert result["overview"]["coverage_pct"] == 50

    def test_high_accuracy_declining_flagged(self, db_session, make_subject):
        subject = make_subject()
        _seed_bank(db_session, subject, ["Array"])
        _seed_profile(db_session, subject,
                      mastery={"Array": {"accuracy": 78, "attempts": 4, "sessions": 2}},
                      weak=["Array"], trends={"Array": [90, 78]})

        result = run_diagnostic(db_session, subject.id)

        assert result["weak_topics"][0]["trend_direction"] == "turun"
        assert result["weak_topics"][0]["corrective"]["modality"] == "flashcard"

    def test_risk_flag_low_retention(self, db_session, make_subject):
        subject = make_subject()
        db_session.add(Flashcard(subject_id=subject.id, question="q", answer="a",
                                 times_seen=4, times_correct=1, mastered=0))
        db_session.commit()

        result = run_diagnostic(db_session, subject.id)

        codes = [f["code"] for f in result["risk_flags"]]
        assert "low_retention" in codes

    def test_risk_flag_wrong_streak(self, db_session, make_subject):
        from models import ExamSession, ExamAttempt, ExamReview
        subject = make_subject()
        session = ExamSession(subject_id=subject.id, total_questions=5, score=0)
        db_session.add(session)
        db_session.commit()
        attempt = ExamAttempt(session_id=session.id, total_correct=0, total_wrong=5)
        db_session.add(attempt)
        db_session.commit()
        for i in range(5):
            db_session.add(ExamReview(attempt_id=attempt.id, question_number=i + 1,
                                      topic="Array", question_text=f"q{i}",
                                      is_correct=0))
        db_session.commit()

        result = run_diagnostic(db_session, subject.id)

        assert "wrong_streak" in [f["code"] for f in result["risk_flags"]]

    def test_no_data_action_item(self, db_session, make_subject):
        subject = make_subject()
        _seed_bank(db_session, subject, ["Array"])
        # tanpa LearningProfile sama sekali
        result = run_diagnostic(db_session, subject.id)

        assert result["action_items"][0]["topic"] == "Array"
        assert result["action_items"][0]["modality"] == "micro_quiz"


@pytest.fixture()
def client(db_session):
    from fastapi.testclient import TestClient
    from main import app
    app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(app)
    app.dependency_overrides.clear()


class TestDiagnosticEndpoint:
    def test_returns_diagnostic(self, client, db_session, make_subject):
        subject = make_subject()
        _seed_bank(db_session, subject, ["Array"])
        _seed_profile(db_session, subject,
                      mastery={"Array": {"accuracy": 80, "attempts": 3, "sessions": 2}},
                      strong=["Array"])

        resp = client.get(f"/api/study/diagnostic?subject_id={subject.id}")

        assert resp.status_code == 200
        body = resp.json()
        assert body["readiness"]["level"] == "siap_ujian"
        assert body["overview"]["topics_covered"] == 1
        assert body["risk_flags"] == []

    def test_subject_not_found(self, client):
        resp = client.get("/api/study/diagnostic?subject_id=99999")
        assert resp.status_code == 404
