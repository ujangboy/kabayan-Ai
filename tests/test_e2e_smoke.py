"""
E2E Smoke — rantai penuh aplikasi dari upload materi sampai diagnostik (tanpa LLM).

Alur yang diverifikasi (semua endpoint HTTP nyata, DB isolasi total):
  1. Buat subject → upload materi TXT → proses manual (RAG index di-mock,
     karena embedding butuh download model besar & LanceDB asli tidak disentuh)
  2. Semua endpoint belajar Study Engine: route, metrics, daily-plan,
     knowledge-graph, progress, diagnostic — 200 + bentuk payload benar
  3. FSRS: buat flashcard → review → next_review terhitung
  4. Whisper (US1.1): upload audio (transcribe di-mock) → transkrip → Ready
  5. Backup ZIP berisi file upload
  6. Hapus subject → materi masuk trash (safety-net D2)

Test ini jaring pengaman integrasi: kegagalan di sini = fitur tidak nyambung.
"""
import datetime
import json
import os
import zipfile

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


@pytest.fixture()
def fake_rag(monkeypatch):
    """Matikan embedding/LanceDB: index_document jadi no-op tercatat."""
    from services.rag_service import rag_service
    indexed = []

    def _fake_index(doc_id, chunks):
        indexed.append({"doc_id": doc_id, "chunks": len(chunks)})

    monkeypatch.setattr(rag_service, "index_document", _fake_index)
    return indexed


@pytest.fixture()
def fake_transcribe(monkeypatch):
    from services import transcription_service

    monkeypatch.setattr(
        transcription_service,
        "transcribe",
        lambda audio_path: {"text": "Fotosintesis adalah proses tumbuhan mengubah cahaya menjadi energi.", "language": "id"},
    )


@pytest.fixture()
def isolated_backup_dir(tmp_path, monkeypatch):
    import config

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
        self, client, db_session, make_subject, fake_rag, fake_transcribe, isolated_backup_dir, tmp_path
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
        from services.material_service import material_service
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

        # ── 4. Whisper audio (transkrip di-mock) ───────────────────────
        res = client.post(
            "/api/materials/audio",
            data={"subject_id": str(subj.id)},
            files={"file": ("kuliah.mp3", b"\x00" * 4096, "audio/mpeg")},
        )
        assert res.status_code == 200

        res = client.get(f"/api/materials?subject_id={subj.id}")
        mats = res.json()["materials"]
        assert len(mats) == 2
        audio_mat = next(m for m in mats if m["filename"] == "kuliah.mp3")
        assert audio_mat["material_type"] == "TXT"
        assert audio_mat["status"] == "Ready"
        assert audio_mat["filepath"] is not None
        assert os.path.exists(audio_mat["filepath"])
        with open(audio_mat["filepath"], encoding="utf-8") as f:
            assert "Fotosintesis" in f.read()

        # ── 5. Backup ZIP ──────────────────────────────────────────────
        res = client.post("/api/backup/create")
        assert res.status_code == 200
        info = res.json()
        with zipfile.ZipFile(info["path"]) as zf:
            names = set(zf.namelist())
        assert any(n.startswith("uploads/") for n in names)

        # ── 6. Hapus subject → materi masuk trash ──────────────────────
        res = client.post(f"/api/subjects/{subj.id}/delete")
        assert res.status_code == 200

        res = client.get("/api/trash")
        trash_items = res.json()["items"]
        trashed_names = " ".join(i.get("original_filename") or "" for i in trash_items)
        assert len(trash_items) >= 2
        assert ".mp3" in trashed_names or ".txt" in trashed_names

        # Study endpoints tetap berjalan (subject 404 ditangani)
        res = client.get(f"/api/study/progress?subject_id={subj.id}")
        assert res.status_code == 404

    def test_study_endpoints_empty_subject(self, client, make_subject):
        """Subject baru tanpa data: semua endpoint tetap 200 dengan payload kosong."""
        subj = make_subject("Kosong")
        for path in ["metrics", "daily-plan", "knowledge-graph", "progress", "diagnostic"]:
            res = client.get(f"/api/study/{path}?subject_id={subj.id}")
            assert res.status_code == 200, f"{path} gagal: {res.status_code}"
        res = client.post("/api/study/route", json={"subject_id": subj.id, "tier": None})
        assert res.status_code == 200