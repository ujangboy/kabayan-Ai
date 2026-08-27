"""Test endpoint chat backend-backed (R2): GET /api/chats & DELETE session."""
import pytest
from fastapi.testclient import TestClient
from main import app
from database import get_db
from repositories.chat_repository import chat_repository


@pytest.fixture()
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(app)
    app.dependency_overrides.clear()


def _seed_chat(db_session, session_uuid="1718000000000", title="Chat Uji"):
    chat = chat_repository.get_or_create_by_uuid(db_session, session_uuid)
    chat.title = title
    db_session.commit()
    db_session.refresh(chat)
    return chat


def test_list_chats_returns_seeded(client, db_session):
    _seed_chat(db_session, "111", "Satu")
    _seed_chat(db_session, "222", "Dua")
    res = client.get("/api/chats")
    assert res.status_code == 200
    data = res.json()
    assert data["count"] == 2
    uuids = {c["session_uuid"] for c in data["chats"]}
    assert {"111", "222"} <= uuids
    # field kunci ada
    c = next(c for c in data["chats"] if c["session_uuid"] == "111")
    assert c["title"] == "Satu"
    assert "created_at" in c and "message_count" in c


def test_list_chats_empty(client):
    res = client.get("/api/chats")
    assert res.status_code == 200
    assert res.json()["count"] == 0


def test_delete_by_session_uuid(client, db_session):
    _seed_chat(db_session, "999", "Hapus Saya")
    res = client.post("/api/chat/session/999/delete")
    assert res.status_code == 200
    assert res.json()["status"] == "success"
    # sudah tidak ada di list
    after = client.get("/api/chats").json()
    assert all(c["session_uuid"] != "999" for c in after["chats"])


def test_delete_by_session_uuid_unknown_404(client):
    res = client.post("/api/chat/session/nope/delete")
    assert res.status_code == 404


def test_clear_chats(client, db_session):
    _seed_chat(db_session, "a1")
    _seed_chat(db_session, "a2")
    assert client.get("/api/chats").json()["count"] == 2
    res = client.post("/api/chat/clear")
    assert res.status_code == 200
    assert client.get("/api/chats").json()["count"] == 0
