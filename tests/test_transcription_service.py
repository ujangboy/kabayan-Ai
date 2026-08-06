"""US1.1 — transkripsi audio: validasi format, service transcribe (mock Groq),
endpoint /api/materials/audio, dan pipeline materi audio (transkrip → RAG)."""
import os
import types

import pytest
import config
from database import get_db
from models import Material
from services.material_service import material_service
from services.transcription_service import transcribe, validate_audio

MP3 = ".mp3"


# ─── validate_audio ───────────────────────────────────────────────────────────

class TestValidateAudio:
    def test_accepts_supported_formats(self):
        for ext in (".mp3", ".wav", ".m4a", ".ogg", ".flac"):
            validate_audio(f"kuliah{ext}", 1_000_000)  # tidak melempar

    def test_rejects_unknown_extension(self):
        with pytest.raises(ValueError, match="Format audio tidak didukung"):
            validate_audio("rekaman.xyz", 1_000_000)

    def test_rejects_empty_filename(self):
        with pytest.raises(ValueError, match="Format audio tidak didukung"):
            validate_audio("", 1_000_000)

    def test_rejects_oversize(self):
        with pytest.raises(ValueError, match="terlalu besar"):
            validate_audio("a.mp3", 24 * 1024 * 1024 + 1)

    def test_accepts_exactly_at_limit(self):
        validate_audio("a.mp3", 24 * 1024 * 1024)  # == 24MB → masih diterima


# ─── transcribe ───────────────────────────────────────────────────────────────

def _write_audio(tmp_path, name="kuliah.mp3", size=2048):
    fp = os.path.join(str(tmp_path), name)
    with open(fp, "wb") as f:
        f.write(b"\x00" * size)
    return fp


class _FakeTranscriptions:
    def __init__(self, response):
        self._response = response

    def create(self, **kwargs):
        return self._response


class _FakeAudio:
    def __init__(self, response):
        self.transcriptions = _FakeTranscriptions(response)


class _FakeGroq:
    def __init__(self, api_key, response=None):
        self.api_key = api_key
        self.audio = _FakeAudio(response)


class TestTranscribe:
    def test_missing_api_key_raises(self, tmp_path, monkeypatch):
        monkeypatch.setattr(config, "GROQ_API_KEY", "")
        with pytest.raises(ValueError, match="GROQ_API_KEY"):
            transcribe(_write_audio(tmp_path))

    def test_missing_file_raises(self, tmp_path, monkeypatch):
        monkeypatch.setattr(config, "GROQ_API_KEY", "test")
        with pytest.raises(ValueError, match="tidak ditemukan"):
            transcribe(os.path.join(str(tmp_path), "hilang.mp3"))

    def test_parses_object_response(self, tmp_path, monkeypatch):
        monkeypatch.setattr(config, "GROQ_API_KEY", "test")
        seg = types.SimpleNamespace(text="Halo dunia", start=0.0, end=1.5)
        response = types.SimpleNamespace(
            text="Halo dunia", duration=3, language="id", segments=[seg]
        )
        monkeypatch.setattr("groq.Groq", lambda api_key: _FakeGroq(api_key, response))

        result = transcribe(_write_audio(tmp_path))

        assert result["language"] == "id"
        assert result["duration"] == 3
        assert result["segments"] == [{"text": "Halo dunia", "start": 0.0, "end": 1.5}]

    def test_parses_dict_response(self, tmp_path, monkeypatch):
        monkeypatch.setattr(config, "GROQ_API_KEY", "test")
        response = {
            "text": "Jaringan komputer",
            "duration": 2,
            "language": "en",
            "segments": [{"text": "Jaringan komputer", "start": 0.0, "end": 2.0}],
        }
        monkeypatch.setattr("groq.Groq", lambda api_key: _FakeGroq(api_key, response))

        result = transcribe(_write_audio(tmp_path))

        assert result["language"] == "en"
        assert result["segments"] == [{"text": "Jaringan komputer", "start": 0.0, "end": 2.0}]

    def test_raises_friendly_on_empty_audio(self, tmp_path, monkeypatch):
        monkeypatch.setattr(config, "GROQ_API_KEY", "test")
        response = types.SimpleNamespace(text="", duration=0, language="id", segments=[])
        monkeypatch.setattr("groq.Groq", lambda api_key: _FakeGroq(api_key, response))

        with pytest.raises(ValueError, match="tidak ada ucapan"):
            transcribe(_write_audio(tmp_path))

    def test_raises_friendly_on_rate_limit(self, tmp_path, monkeypatch):
        monkeypatch.setattr(config, "GROQ_API_KEY", "test")

        class _Boom:
            pass

        def _raise(**kwargs):
            raise RuntimeError("Error code: 429. Rate limit exceeded")

        class _BadTranscriptions:
            create = staticmethod(_raise)

        class _BadAudio:
            transcriptions = _BadTranscriptions()

        class _BadGroq:
            audio = _BadAudio()

        monkeypatch.setattr("groq.Groq", lambda api_key: _BadGroq())

        with pytest.raises(ValueError, match="Batas permintaan"):
            transcribe(_write_audio(tmp_path))

    def test_skips_extension_validation_when_validate_ext_false(self, tmp_path, monkeypatch):
        monkeypatch.setattr(config, "GROQ_API_KEY", "test")
        seg = types.SimpleNamespace(text="x", start=0.0, end=1.0)
        response = types.SimpleNamespace(text="x", duration=1, language="id", segments=[seg])
        monkeypatch.setattr("groq.Groq", lambda api_key: _FakeGroq(api_key, response))

        # webm/opus bukan format upload user, tapi valid untuk Groq (jalur YouTube)
        fp = _write_audio(tmp_path, name="video.webm")
        result = transcribe(fp, validate_ext=False)
        assert result["text"] == "x"


# ─── endpoint /api/materials/audio ────────────────────────────────────────────

@pytest.fixture()
def client(db_session):
    from fastapi.testclient import TestClient
    from main import app
    app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(app)
    app.dependency_overrides.clear()


class TestUploadAudioEndpoint:
    def _post(self, client, subject_id, filename, content):
        return client.post(
            "/api/materials/audio",
            data={"subject_id": str(subject_id)},
            files={"file": (filename, content, "audio/mpeg")},
        )

    def test_upload_creates_processing_material(self, client, db_session, make_subject, monkeypatch):
        monkeypatch.setattr(
            "services.material_service.material_service.process_audio_material_async",
            lambda material_id: None,
        )
        subject = make_subject()
        resp = self._post(client, subject.id, "kuliah.mp3", b"\x00" * 2048)

        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "processing"
        assert body["material_id"] > 0

        mat = db_session.query(Material).filter(Material.id == body["material_id"]).first()
        assert mat is not None
        # Status Processing (bukan Pending) agar worker materi tidak mengambilnya
        assert mat.status == "Processing"
        assert mat.material_type.value == "TXT"
        assert mat.filepath and os.path.exists(mat.filepath)

    def test_upload_rejects_unknown_format(self, client, db_session, make_subject):
        subject = make_subject()
        resp = self._post(client, subject.id, "rekaman.xyz", b"data")
        assert resp.status_code == 400
        assert "Format audio tidak didukung" in resp.json()["message"]
        assert db_session.query(Material).count() == 0

    def test_upload_rejects_oversize(self, client, db_session, make_subject, monkeypatch):
        monkeypatch.setattr("services.transcription_service.MAX_AUDIO_SIZE_MB", 1)
        subject = make_subject()
        resp = self._post(client, subject.id, "panjang.mp3", b"\x00" * (1024 * 1024 + 1))
        assert resp.status_code == 400
        assert "terlalu besar" in resp.json()["message"]

    def test_upload_missing_subject_rejected(self, client, db_session):
        resp = client.post(
            "/api/materials/audio",
            files={"file": ("a.mp3", b"\x00" * 100, "audio/mpeg")},
        )
        assert resp.status_code in (400, 422)


# ─── pipeline process_audio_material_async ────────────────────────────────────

class TestAudioMaterialPipeline:
    def test_transcript_indexed_and_marked_ready(self, db_session, make_subject, make_material, monkeypatch):
        subject = make_subject()
        fp = os.path.join(config.UPLOADS_DIR, "kuliah.mp3")
        with open(fp, "wb") as f:
            f.write(b"\x00" * 100)
        mat = make_material(subject.id, status="Processing", filepath=fp, filename="kuliah.mp3")

        monkeypatch.setattr(
            "services.transcription_service.transcribe",
            lambda path: {
                "text": "Ini adalah materi kuliah pertama tentang jaringan komputer.",
                "segments": [],
                "duration": 3,
                "language": "id",
            },
        )

        material_service.process_audio_material_async(mat.id)

        db_session.expire_all()
        db_session.refresh(mat)
        assert mat.status == "Ready"
        assert mat.language == "id"
        assert mat.filepath and mat.filepath.endswith(".txt")
        assert os.path.exists(mat.filepath)
        with open(mat.filepath, encoding="utf-8") as f:
            assert "jaringan komputer" in f.read()
        # audio asli tidak tersisa (dipindah ke trash)
        assert not os.path.exists(fp)

    def test_transcribe_failure_marks_failed(self, db_session, make_subject, make_material, monkeypatch):
        subject = make_subject()
        fp = os.path.join(config.UPLOADS_DIR, "error.mp3")
        with open(fp, "wb") as f:
            f.write(b"\x00" * 100)
        mat = make_material(subject.id, status="Processing", filepath=fp, filename="error.mp3")

        monkeypatch.setattr(
            "services.transcription_service.transcribe",
            lambda path: (_ for _ in ()).throw(ValueError("Audio kosong — tidak ada ucapan.")),
        )

        material_service.process_audio_material_async(mat.id)

        db_session.expire_all()
        db_session.refresh(mat)
        assert mat.status == "Failed"
        assert mat.filepath is None
        assert "tidak ada ucapan" in mat.failure_reason

    def test_missing_material_is_noop(self, db_session):
        material_service.process_audio_material_async(999_999)  # tidak melempar
