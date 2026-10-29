"""Test POST /api/chat/vision + image_service + ai_service.vision_read.

Fitur: user melampirkan screenshot/foto papan tulis di chat; AI (qwen vision)
membaca isinya dan menjawab. Kontrak: FormData {session_id, message, file}
→ JSON {transcription, answer, chat_id, msg_id}.
"""
import io
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import config
from app.database import get_db
from app.exceptions import AppError
from app.main import app
from app.repositories.chat_repository import chat_repository
from app.services import image_service
from app.services.ai_service import ai_service


@pytest.fixture()
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(app)
    app.dependency_overrides.clear()


def _png_bytes(size=(4, 4)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, "white").save(buf, format="PNG")
    return buf.getvalue()


def _post_vision(client, png, message="Apa isi gambar ini?", filename="papan.png"):
    return client.post(
        "/api/chat/vision",
        data={"session_id": "sess-vision-1", "message": message},
        files={"file": (filename, png, "image/png")},
    )


# ─── Endpoint ────────────────────────────────────────────────────────────────

def test_vision_happy_path_persists_messages(client, db_session, monkeypatch):
    monkeypatch.setattr(
        ai_service, "vision_read",
        lambda text, data_url: {"transcription": "a + b = c", "answer": "Rumus penjumlahan."},
    )
    res = _post_vision(client, _png_bytes())
    assert res.status_code == 200
    body = res.json()
    assert body["transcription"] == "a + b = c"
    assert body["answer"] == "Rumus penjumlahan."
    assert body["chat_id"] > 0 and body["msg_id"] > 0

    chat = chat_repository.get_or_create_by_uuid(db_session, "sess-vision-1")
    msgs = chat_repository.get_messages(db_session, chat.id)
    assert [m.role for m in msgs] == ["user", "assistant"]
    assert "Apa isi gambar ini?" in msgs[0].content  # pesan user
    assert "Teks yang saya baca" in msgs[1].content
    assert "a + b = c" in msgs[1].content
    assert "Rumus penjumlahan." in msgs[1].content


def test_vision_message_form_required(client, db_session, monkeypatch):
    """message kosong → teks default dipakai utk pesan user yang tersimpan."""
    monkeypatch.setattr(
        ai_service, "vision_read",
        lambda text, data_url: {"transcription": "t", "answer": "a"},
    )
    res = client.post(
        "/api/chat/vision",
        data={"session_id": "sess-vision-2", "message": ""},
        files={"file": ("img.png", _png_bytes(), "image/png")},
    )
    assert res.status_code == 200
    chat = chat_repository.get_or_create_by_uuid(db_session, "sess-vision-2")
    msgs = chat_repository.get_messages(db_session, chat.id)
    assert msgs[0].content == "Apa isi gambar ini?"


def test_vision_tanpa_session_tolak(client):
    res = client.post(
        "/api/chat/vision",
        data={"message": "x"},
        files={"file": ("img.png", _png_bytes(), "image/png")},
    )
    assert res.status_code in (422, 400)


def test_vision_invalid_type_400(client):
    res = client.post(
        "/api/chat/vision",
        data={"session_id": "s3", "message": "baca"},
        files={"file": ("catatan.txt", b"hanya teks biasa", "text/plain")},
    )
    assert res.status_code == 400
    assert "format" in res.json()["detail"].lower()


def test_vision_oversize_400(client, db_session, monkeypatch):
    monkeypatch.setattr(config, "CHAT_IMAGE_MAX_MB", 0)
    res = _post_vision(client, _png_bytes())
    assert res.status_code == 400
    assert "terlalu besar" in res.json()["detail"].lower()


def test_vision_error_dipetakan(client, db_session, monkeypatch):
    def boom(text, data_url):
        raise AppError("Kuota gratis Groq penuh, coba lagi nanti.", status_code=429)

    monkeypatch.setattr(ai_service, "vision_read", boom)
    res = _post_vision(client, _png_bytes())
    assert res.status_code == 429
    assert "kuota" in res.json()["detail"].lower()


# ─── ai_service.vision_read (mock groq SDK) ─────────────────────────────────

class _FakeGroqClient:
    def __init__(self, content):
        self._content = content
        self.chat = SimpleNamespace(completions=self)
        self.last_kwargs = None

    # dipanggil sbg chat.completions.create(...)
    def create(self, **kwargs):
        self.last_kwargs = kwargs
        msg = SimpleNamespace(content=self._content)
        return SimpleNamespace(choices=[SimpleNamespace(message=msg)])


def _fake_factory(content):
    client = _FakeGroqClient(content)
    return client, lambda: client


def test_vision_read_json_mode(db_session):
    fake, factory = _fake_factory('{"transcription": "abc", "answer": "5"}')
    monkeypatch_local = None
    ai_service._get_groq_client = factory
    try:
        out = ai_service.vision_read("baca", "data:image/jpeg;base64,QUJD")
    finally:
        del ai_service._get_groq_client
    assert out["transcription"] == "abc"
    assert out["answer"] == "5"


def test_vision_read_fallback_bukan_json(db_session):
    clientobj, factory = _fake_factory("Balasan biasa tanpa JSON")
    ai_service._get_groq_client = factory
    try:
        out = ai_service.vision_read("baca", "data:image/jpeg;base64,QUJD")
    finally:
        del ai_service._get_groq_client
    assert out == {"transcription": "", "answer": "Balasan biasa tanpa JSON"}


def test_vision_read_429_dipetakan(db_session):
    def bad_client():
        raise Exception('Error code: 429 - Rate limit exceeded (free tier)')

    ai_service._get_groq_client = bad_client
    try:
        with pytest.raises(AppError) as ei:
            ai_service.vision_read("baca", "data:image/jpeg;base64,QUJD")
    finally:
        del ai_service._get_groq_client
    assert ei.value.status_code == 429
    assert "kuota" in ei.value.message.lower()


def test_vision_read_401_dipetakan(db_session):
    def bad_client():
        raise Exception('Error code: 401 - Authentication error')

    ai_service._get_groq_client = bad_client
    try:
        with pytest.raises(AppError) as ei:
            ai_service.vision_read("baca", "data:image/jpeg;base64,QUJD")
    finally:
        del ai_service._get_groq_client
    assert ei.value.status_code == 401


# ─── image_service.prepare_image ─────────────────────────────────────────────

def test_prepare_image_png_jadi_data_url_jpeg():
    out = image_service.prepare_image(_png_bytes())
    assert out.startswith("data:image/jpeg;base64,")


def test_prepare_image_resize_ke_batas_dimensi():
    out = image_service.prepare_image(_png_bytes((2500, 2600)))
    assert out.startswith("data:image/jpeg;base64,")


def test_prepare_image_bukan_gambar_mentok():
    with pytest.raises(AppError) as ei:
        image_service.prepare_image(b"ini teks bukan gambar")
    assert ei.value.status_code == 400
