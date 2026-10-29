"""
Test untuk endpoint Pengaturan: /api/profile, /api/profile/photo, /api/info,
dan /api/data/overview. Memakai TestClient dengan dependency_overrides agar
memakai session temporer (tidak menyentuh DB produksi).
"""
import io
import pytest

from app.database import get_db
from app.services.settings_service import settings_service


@pytest.fixture()
def client(db_session):
    from fastapi.testclient import TestClient
    from app.main import app
    app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(app)
    app.dependency_overrides.clear()


# ─── /api/profile ─────────────────────────────────────────────────────

class TestSettingsReadEndpoint:
    def test_get_settings_returns_active_config(self, client, db_session):
        resp = client.get("/api/settings")
        assert resp.status_code == 200
        data = resp.json()
        # Field inti tersedia untuk panel settings
        assert "embedding_model" in data
        assert "display_name" in data
        assert data["allowed_embedding_models"] == [
            "all-MiniLM-L6-v2", "paraphrase-multilingual-MiniLM-L12-v2"
        ]
        # Nilai embedding model selalu dari allowlist (konsisten dengan POST)
        assert data["embedding_model"] in data["allowed_embedding_models"]

    def test_roundtrip_post_then_get(self, client, db_session):
        model = "paraphrase-multilingual-MiniLM-L12-v2"
        resp = client.post("/api/settings", data={"embedding_model": model})
        assert resp.status_code == 200
        got = client.get("/api/settings").json()
        assert got["embedding_model"] == model
        settings_service.set_embedding_model(db_session, "all-MiniLM-L6-v2")


class TestProfileEndpoint:
    def test_profile_defaults(self, client, db_session):
        resp = client.get("/api/profile")
        assert resp.status_code == 200
        data = resp.json()
        assert data["display_name"] == ""
        assert data["photo_path"] == ""
        assert data["language"] == "id"

    def test_update_display_name(self, client, db_session):
        resp = client.put("/api/profile", json={"display_name": "Andi", "language": "id"})
        assert resp.status_code == 200
        assert resp.json()["display_name"] == "Andi"
        # tersimpan persisten di Setting
        assert settings_service.get_display_name(db_session) == "Andi"

    def test_update_language(self, client, db_session):
        resp = client.put("/api/profile", json={"display_name": "", "language": "en"})
        assert resp.status_code == 200
        assert resp.json()["language"] == "en"

    def test_invalid_language_rejected(self, client, db_session):
        resp = client.put("/api/profile", json={"display_name": "", "language": "xx"})
        assert resp.status_code == 400

    def test_remove_photo_flag(self, client, db_session, tmp_path, monkeypatch):
        # Arahkan direktori foto ke temp, simulasikan foto lama tersimpan.
        from app import config
        fake_dir = tmp_path / "profile"
        fake_dir.mkdir()
        monkeypatch.setattr("app.routers.profile.PROFILE_DIR", str(fake_dir))
        # _try_remove_photo membangun path dari config.BASE_DIR (dirujuk ke tmp_path oleh conftest).
        import os
        real_dir = os.path.join(config.BASE_DIR, "static", "profile")
        os.makedirs(real_dir, exist_ok=True)
        old = os.path.join(real_dir, "old.png")
        with open(old, "wb") as f:
            f.write(b"\x89PNG\r\n\x1a\n" + b"\x00" * 40)
        settings_service.set_photo_path(db_session, "/static/profile/old.png")

        resp = client.put("/api/profile", json={
            "display_name": "Andi",
            "language": "id",
            "remove_photo": True,
        })
        assert resp.status_code == 200
        assert resp.json()["photo_path"] == ""
        assert not os.path.exists(old)


# ─── /api/usage ───────────────────────────────────────────────────────

class TestUsageEndpoint:
    def test_usage_defaults(self, client):
        resp = client.get("/api/usage")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_tokens"] == 0
        assert data["total_calls"] == 0
        assert data["features"] == []

    def test_usage_records_and_aggregates(self, client, db_session):
        from app.services.usage_service import record_usage
        record_usage(db_session, "quiz", "a" * 400)   # ~100 token
        record_usage(db_session, "quiz", "b" * 400)   # ~100 token, fitur sama
        record_usage(db_session, "tutor", "x" * 100)  # ~25 token, fitur beda

        resp = client.get("/api/usage")
        data = resp.json()
        assert data["total_tokens"] == 225
        assert data["total_calls"] == 3

        by_feature = {f["feature"]: f for f in data["features"]}
        assert by_feature["quiz"]["tokens"] == 200
        assert by_feature["quiz"]["calls"] == 2
        assert by_feature["tutor"]["tokens"] == 25
        assert by_feature["tutor"]["calls"] == 1


# ─── /api/profile/photo ───────────────────────────────────────────────

class TestProfilePhotoEndpoint:
    def test_upload_png(self, client, db_session, tmp_path, monkeypatch):
        # Arahkan direktori foto ke temp agar tidak menumpuk di static/
        from app import config
        fake_dir = tmp_path / "profile"
        fake_dir.mkdir()
        monkeypatch.setattr("app.routers.profile.PROFILE_DIR", str(fake_dir))

        # 1x1 PNG (magic bytes valid)
        png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 40
        resp = client.post(
            "/api/profile/photo",
            files={"file": ("avatar.png", io.BytesIO(png_bytes), "image/png")},
        )
        assert resp.status_code == 200
        photo_path = resp.json()["photo_path"]
        assert photo_path.startswith("/static/profile/")
        assert settings_service.get_photo_path(db_session) == photo_path

    def test_reject_non_image(self, client, db_session):
        resp = client.post(
            "/api/profile/photo",
            files={"file": ("fake.jpg", io.BytesIO(b"not a real jpeg"), "image/jpeg")},
        )
        assert resp.status_code == 400

    def test_reject_bad_extension(self, client, db_session):
        resp = client.post(
            "/api/profile/photo",
            files={"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")},
        )
        assert resp.status_code == 400

    def test_reject_empty_file(self, client, db_session):
        resp = client.post(
            "/api/profile/photo",
            files={"file": ("a.png", io.BytesIO(b""), "image/png")},
        )
        assert resp.status_code == 400


# ─── /api/info ────────────────────────────────────────────────────────

class TestInfoEndpoint:
    def test_info(self, client):
        resp = client.get("/api/info")
        assert resp.status_code == 200
        data = resp.json()
        assert data["app_name"]
        assert data["version"]


# ─── /api/data/overview ───────────────────────────────────────────────

class TestDataOverviewEndpoint:
    def test_overview_defaults(self, client):
        resp = client.get("/api/data/overview")
        assert resp.status_code == 200
        data = resp.json()
        stats = data["stats"]
        for key in ("subjects", "materials", "chats", "messages", "notes",
                    "flashcards", "quizzes", "exam_sessions", "exam_blueprints",
                    "question_bank", "materials_ready", "materials_pending",
                    "materials_failed"):
            assert key in stats
        assert "storage" in data
        assert "total" in data["storage"]

    def test_overview_counts_data(self, client, db_session):
        from app import models
        subj = models.Subject(name="Materi Test")
        db_session.add(subj)
        db_session.commit()
        db_session.refresh(subj)

        db_session.add(models.Material(
            subject_id=subj.id, filename="a.pdf", status="Ready", progress=100,
        ))
        db_session.commit()

        resp = client.get("/api/data/overview")
        data = resp.json()
        assert data["stats"]["materials"] == 1
        assert data["stats"]["materials_ready"] == 1