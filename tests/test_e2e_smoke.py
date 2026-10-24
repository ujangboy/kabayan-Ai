"""
E2E Smoke — rantai penuh aplikasi dari upload materi sampai diagnostik (tanpa LLM).

Alur yang diverifikasi (semua endpoint HTTP nyata, DB isolasi total):
  1. Buat subject → upload materi TXT → proses manual (RAG index di-mock,
     karena embedding butuh download model besar & LanceDB asli tidak disentuh)
  2. Semua endpoint belajar Study Engine: route, metrics, daily-plan,
     knowledge-graph, progress, diagnostic — 200 + bentuk payload benar
  3. FSRS: buat flashcard → review → next_review terhitung
  4. Backup ZIP berisi file upload
  5. Hapus subject → materi masuk trash (safety-net D2)

Test ini jaring pengaman integrasi: kegagalan di sini = fitur tidak nyambung.
"""
import datetime
import json
import zipfile

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


@pytest.fixture()
def fake_rag(monkeypatch):
    """Matikan embedding/LanceDB: index_document jadi no-op tercatat."""
    from app.services.rag_service import rag_service
    indexed = []

    def _fake_index(doc_id, chunks):
        indexed.append({"doc_id": doc_id, "chunks": len(chunks)})

    monkeypatch.setattr(rag_service, "index_document", _fake_index)
    return indexed


@pytest.fixture()
def isolated_backup_dir(tmp_path, monkeypatch):
    from app import config

    backups = tmp_path / "storage" / "backups"
    backups.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(config, "BACKUPS_DIR", str(backups))
    return backups


def _txt_content():
    paragraphs = []
    for i in range(30):
        paragraphs.append(
            f"Bab {i}. Fotosintesis dan respirasi adalah proses inti metabolisme tumbuhan. "
            "Klorofil menyerap cahaya matahari untuk menghasilkan glukosa dan oksigen."
        )
    return "\n\n".join(paragraphs)


def _seed_profile(db, subject_id):
    db.add(models.LearningProfile(
        user_key="local", subject_id=subject_id,
        topics_mastery=json.dumps({"Fotosintesis": {"accuracy": 45, "attempts": 4, "sessions": 2}}),
        weak_topics=json.dumps(["Fotosintesis"]),
        strong_topics="[]",
        total_sessions=2, total_questions=4, total_correct=2,
        topic_trend_json=json.dumps({"Fotosintesis": [40, 45]}),
    ))
    db.commit()


class TestFullChain:
    def test_e2e_full_flow(
        self, client, db_session, make_subject, fake_rag, isolated_backup_dir, tmp_path
    ):
        # ── 1. Subject + materi TXT ─────────────────────────────────────
        subj = make_subject("Biologi")
        _seed_profile(db_session, subj.id)

        txt = _txt_content()
        res = client.post(
            "/api/materials",
            data={"subject_id": str(subj.id)},
            files={"file": ("bahan.txt", txt.encode("utf-8"), "text/plain")},
        )
        assert res.status_code == 200

        res = client.get(f"/api/materials?subject_id={subj.id}")
        materials = res.json()["materials"]
        assert len(materials) == 1
        mat = materials[0]
        assert mat["status"] == "Pending"

        # Proses manual (worker background tidak jalan di test)
        from app.services.material_service import material_service
        db_session.query(models.Material).filter(models.Material.id == mat["id"]).update({"status": "Processing"})
        db_session.commit()
        material_service.process_material_async(mat["filepath"], f"mat_{mat['id']}", mat["id"])

        res = client.get(f"/api/materials?subject_id={subj.id}")
        processed = res.json()["materials"][0]
        assert processed["status"] == "Ready"
        assert fake_rag and fake_rag[0]["doc_id"] == f"mat_{mat['id']}"
        assert fake_rag[0]["chunks"] >= 2

        # ── 2. Study Engine ────────────────────────────────────────────
        res = client.post("/api/study/route", json={"subject_id": subj.id, "tier": None})
        assert res.status_code == 200
        body = res.json()
        assert body["mode"] == "all"
        assert len(body["recommendations"]) == 3
        assert body["primary"] is not None

        res = client.get(f"/api/study/metrics?subject_id={subj.id}")
        assert res.status_code == 200
        assert "fsrs_overview" in res.json()

        res = client.get(f"/api/study/daily-plan?subject_id={subj.id}&free_minutes=30")
        assert res.status_code == 200
        assert "items" in res.json() and "empty_reason" in res.json()

        res = client.get(f"/api/study/knowledge-graph?subject_id={subj.id}")
        assert res.status_code == 200
        kg = res.json()
        assert "nodes" in kg and "edges" in kg and "meta" in kg

        res = client.get(f"/api/study/progress?subject_id={subj.id}")
        assert res.status_code == 200
        prog = res.json()
        assert "streak" in prog and "mastery_trend" in prog
        assert prog["mastery_trend"]["direction"] == "naik"

        res = client.get(f"/api/study/diagnostic?subject_id={subj.id}")
        assert res.status_code == 200
        diag = res.json()
        assert "readiness" in diag and "weak_topics" in diag and "risk_flags" in diag

        # ── 3. FSRS ────────────────────────────────────────────────────
        res = client.post(
            "/api/flashcards",
            data={"question": "Apa fungsi klorofil?", "answer": "Menyerap cahaya", "subject_id": str(subj.id)},
        )
        assert res.status_code == 200

        res = client.get(f"/api/flashcards/review/due?subject_id={subj.id}")
        due = res.json()
        assert due["due_count"] == 1
        card_id = due["flashcards"][0]["id"]

        res = client.post(
            "/api/flashcards/review",
            json={"flashcard_id": card_id, "rating": 3, "response_time_ms": 1200},
        )
        assert res.status_code == 200
        review = res.json()
        assert review["next_review"] is not None

        # Kartu selesai review → tidak due lagi (interval positif)
        res = client.get(f"/api/flashcards/review/due?subject_id={subj.id}")
        assert res.json()["due_count"] == 0

        res = client.get(f"/api/flashcards/stats?subject_id={subj.id}")
        stats = res.json()
        assert stats["total"] == 1

        # ── 4. Backup ZIP ──────────────────────────────────────────────
        res = client.post("/api/backup/create")
        assert res.status_code == 200
        info = res.json()
        with zipfile.ZipFile(info["path"]) as zf:
            names = set(zf.namelist())
        assert any(n.startswith("uploads/") for n in names)

        # ── 5. Hapus subject → soft-delete, materi & riwayat tetap utuh ─
        res = client.post(f"/api/subjects/{subj.id}/delete")
        assert res.status_code == 200

        res = client.get("/api/subjects/trash")
        assert res.status_code == 200
        trashed_subjects = res.json()["subjects"]
        assert subj.id in {s["id"] for s in trashed_subjects}

        # Subject hilang dari listing aktif, tetapi data terkait tidak dihapus.
        res = client.get("/api/subjects")
        assert subj.id not in {s["id"] for s in res.json()["subjects"]}

        db_session.expire_all()
        assert db_session.get(models.Subject, subj.id).status == "trashed"
        assert db_session.get(models.Material, mat["id"]) is not None

        # Endpoint study tetap dapat membaca data subject yang di-trash.
        res = client.get(f"/api/study/progress?subject_id={subj.id}")
        assert res.status_code == 200

    def test_study_endpoints_empty_subject(self, client, make_subject):
        """Subject baru tanpa data: semua endpoint tetap 200 dengan payload kosong."""
        subj = make_subject("Kosong")
        for path in ["metrics", "daily-plan", "knowledge-graph", "progress", "diagnostic"]:
            res = client.get(f"/api/study/{path}?subject_id={subj.id}")
            assert res.status_code == 200, f"{path} gagal: {res.status_code}"
        res = client.post("/api/study/route", json={"subject_id": subj.id, "tier": None})
        assert res.status_code == 200