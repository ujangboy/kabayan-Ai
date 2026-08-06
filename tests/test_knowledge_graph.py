"""US4.1 — knowledge graph: node topik/bab, edge contains/depends_on,
bobot dari Learning Profile, prioritas blueprint, endpoint API."""
import json

import pytest

from database import get_db
from engines.knowledge_graph import build_knowledge_graph
from models import QuestionBank, LearningProfile


def _seed(db_session, subject, questions=None, profile=None):
    if questions:
        for q in questions:
            db_session.add(QuestionBank(subject_id=subject.id, **q))
    if profile:
        db_session.add(LearningProfile(
            user_key="local", subject_id=subject.id,
            topics_mastery=json.dumps(profile.get("mastery", {}), ensure_ascii=False),
            weak_topics=json.dumps(profile.get("weak", []), ensure_ascii=False),
            strong_topics=json.dumps(profile.get("strong", []), ensure_ascii=False),
            topic_trend_json=json.dumps(profile.get("trends", {}), ensure_ascii=False),
        ))
    db_session.commit()


class TestKnowledgeGraphEngine:
    def test_empty_subject_returns_empty_graph(self, db_session, make_subject):
        subject = make_subject()
        graph = build_knowledge_graph(db_session, subject.id)
        assert graph["subject_id"] == subject.id
        assert graph["nodes"] == []
        assert graph["edges"] == []
        assert graph["meta"]["data_ready"] is False

    def test_nodes_and_contains_edges_from_question_bank(self, db_session, make_subject):
        subject = make_subject()
        _seed(db_session, subject, questions=[
            {"topic": "Array", "chapter": "Bab 1"},
            {"topic": "Array", "chapter": "Bab 1"},
            {"topic": "Linked List", "chapter": "Bab 1"},
            {"topic": "Tree", "chapter": "Bab 2"},
        ])

        graph = build_knowledge_graph(db_session, subject.id)

        topik_nodes = [n for n in graph["nodes"] if n["type"] == "topik"]
        bab_nodes = [n for n in graph["nodes"] if n["type"] == "bab"]
        assert {n["label"] for n in topik_nodes} == {"Array", "Linked List", "Tree"}
        assert {n["label"] for n in bab_nodes} == {"Bab 1", "Bab 2"}
        # Array muncul 2x di bank
        array = next(n for n in topik_nodes if n["label"] == "Array")
        assert array["questions_in_bank"] == 2
        # edge contains: topik → bab
        contains = [(e["source"], e["target"]) for e in graph["edges"] if e["type"] == "contains"]
        assert ("Array", "bab:Bab 1") in contains
        assert ("Tree", "bab:Bab 2") in contains
        # meta
        assert graph["meta"]["topics_count"] == 3
        assert graph["meta"]["babs_count"] == 2
        assert graph["meta"]["data_ready"] is False  # belum ada mastery

    def test_depends_on_edges_from_material_cooccurrence(self, db_session, make_subject):
        subject = make_subject()
        _seed(db_session, subject, questions=[
            {"topic": "Array", "chapter": "Bab 1", "material_ref": "mat_1"},
            {"topic": "Linked List", "chapter": "Bab 1", "material_ref": "mat_1"},
            {"topic": "Linked List", "chapter": "Bab 1", "material_ref": "mat_2"},
            {"topic": "Queue", "chapter": "Bab 2", "material_ref": "mat_2"},
        ])

        graph = build_knowledge_graph(db_session, subject.id)

        deps = {f"{e['source']}|{e['target']}": e["weight"]
                for e in graph["edges"] if e["type"] == "depends_on"}
        # Array & Linked List muncul di material yang sama (mat_1) → 1
        assert deps.get("Array|Linked List") == 1
        # Linked List & Queue muncul di mat_2 → 1
        assert deps.get("Linked List|Queue") == 1
        assert graph["meta"]["dependencies_count"] == 2

    def test_mastery_and_status_from_learning_profile(self, db_session, make_subject):
        subject = make_subject()
        _seed(db_session, subject, questions=[
            {"topic": "Array", "chapter": "Bab 1"},
            {"topic": "Tree", "chapter": "Bab 2"},
        ], profile={
            "mastery": {"Array": {"accuracy": 85, "attempts": 4, "sessions": 2}},
            "strong": ["Array"],
            "weak": ["Tree"],
            "trends": {"Tree": [60, 45]},
        })

        graph = build_knowledge_graph(db_session, subject.id)

        by_label = {n["label"]: n for n in graph["nodes"] if n["type"] == "topik"}
        assert by_label["Array"]["mastery"] == 85
        assert by_label["Array"]["status"] == "kuat"
        assert by_label["Tree"]["mastery"] is None  # tanpa data mastery tapi lemah via weak_topics
        assert by_label["Tree"]["status"] == "lemah"
        assert graph["meta"]["weak_topics_count"] >= 1
        assert graph["meta"]["data_ready"] is True

    def test_blueprint_adds_concepts_and_priority(self, db_session, make_subject):
        from models import ExamBlueprint
        subject = make_subject()
        _seed(db_session, subject, questions=[
            {"topic": "Array", "chapter": "Bab 1"},
        ])
        db_session.add(ExamBlueprint(
            subject_id=subject.id,
            title="Blueprint UAS",
            blueprint_json=json.dumps({
                "title": "Blueprint UAS",
                "blueprint_items": [
                    {"topic": "Array", "question_count": 5,
                     "key_concepts": ["indeks", "memori", "akses O(1)"]},
                ],
            }, ensure_ascii=False),
        ))
        db_session.commit()

        graph = build_knowledge_graph(db_session, subject.id)

        array = next(n for n in graph["nodes"] if n["label"] == "Array")
        assert array["in_latest_blueprint"] is True
        assert set(array["concepts"]) == {"indeks", "memori", "akses O(1)"}

    def test_topic_with_only_mastery_no_bank(self, db_session, make_subject):
        subject = make_subject()
        _seed(db_session, subject, profile={
            "mastery": {"Teori Grafik": {"accuracy": 50, "attempts": 2, "sessions": 1}},
        })

        graph = build_knowledge_graph(db_session, subject.id)

        labels = {n["label"] for n in graph["nodes"] if n["type"] == "topik"}
        assert "Teori Grafik" in labels
        # tanpa bab → tidak ada edge contains
        assert all(e["type"] != "contains" for e in graph["edges"])


@pytest.fixture()
def client(db_session):
    from fastapi.testclient import TestClient
    from main import app
    app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(app)
    app.dependency_overrides.clear()


class TestKnowledgeGraphEndpoint:
    def test_returns_graph(self, client, db_session, make_subject):
        subject = make_subject()
        db_session.add(QuestionBank(subject_id=subject.id, topic="Array", chapter="Bab 1"))
        db_session.commit()

        resp = client.get(f"/api/study/knowledge-graph?subject_id={subject.id}")

        assert resp.status_code == 200
        body = resp.json()
        assert body["meta"]["topics_count"] == 1
        assert body["nodes"][0]["label"] == "Array"

    def test_subject_not_found(self, client):
        resp = client.get("/api/study/knowledge-graph?subject_id=99999")
        assert resp.status_code == 404

    def test_global_without_subject(self, client, db_session, make_subject):
        subject = make_subject()
        db_session.add(QuestionBank(subject_id=subject.id, topic="Array", chapter="Bab 1"))
        db_session.commit()

        resp = client.get("/api/study/knowledge-graph")
        assert resp.status_code == 200
        assert resp.json()["subject_id"] is None
