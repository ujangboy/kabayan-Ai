"""Health endpoint harus memeriksa resource nyata, bukan nilai hardcoded."""
import asyncio
import json

from sqlalchemy.orm import sessionmaker

import main


def test_health_reports_cache_and_lazy_embedding(db_session, monkeypatch):
    testing_session = sessionmaker(bind=db_session.get_bind())
    monkeypatch.setattr(main, "SessionLocal", testing_session)
    # Health checks configuration presence, not a live API call. Keep the test
    # independent from local secrets so CI can run without a Groq key.
    monkeypatch.setattr(main.config, "GROQ_API_KEY", "test-key")

    response = asyncio.run(main.health_check())
    payload = json.loads(response.body)

    assert response.status_code == 200
    assert payload["status"] == "PASS"
    assert payload["details"]["SQLite"] == "OK"
    assert payload["details"]["Cache"] == "OK"
    assert payload["details"]["Embedding"] in ("OK", "LAZY")
