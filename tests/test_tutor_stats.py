from time_utils import utcnow
"""
Integration test untuk GET /api/tutor/stats dan optimasi token Task C.
"""
import pytest

import models
from routers.tutor import get_tutor_stats
from services.tutor_profile_service import get_or_create_profile
from services.cache_service import cache_service
import asyncio


class TestStatsEndpoint:
    def _make_client(self, db_session):
        from fastapi.testclient import TestClient
        from database import get_db
        from main import app

        def _override():
            yield db_session

        app.dependency_overrides[get_db] = _override
        client = TestClient(app)
        return client

    def test_stats_returns_json(self, db_session):
        get_or_create_profile(db_session)
        client = self._make_client(db_session)
        response = client.get("/api/tutor/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_sessions" in data
        assert "total_messages" in data
        assert "total_tokens" in data
        assert "helpful_count" in data
        assert "not_helpful_count" in data
        assert "helpful_rate" in data

    def test_stats_defaults_zero(self, db_session):
        from services.tutor_profile_service import get_or_create_profile as _goc
        _goc(db_session)  # pastikan profil ada tapi belum ada pesan
        client = self._make_client(db_session)
        response = client.get("/api/tutor/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["total_sessions"] == 0
        assert data["total_messages"] == 0
        assert data["total_tokens"] == 0
        assert data["helpful_count"] == 0
        assert data["not_helpful_count"] == 0
        assert data["helpful_rate"] is None

class TestCacheIntegration:
    def test_cache_service_importable(self):
        from services.cache_service import cache_service
        assert cache_service is not None

    def test_cache_get_set(self, db_session):
        key = "test_key"
        response_text = "Ini adalah respons cached."

        result = cache_service.get_cache(db_session, key, "", "")
        assert result is None

        cache_service.set_cache(db_session, key, "", "", response_text)

        result = cache_service.get_cache(db_session, key, "", "")
        assert result == response_text

    def test_cache_ttl_expires(self, db_session):
        key = "expiring_key"
        cache_service.set_cache(db_session, key, "", "", "old_response")

        from services.cache_service import CACHE_TTL_SECONDS
        import datetime
        from sqlalchemy.orm import Session as SaSession

        # Manually expire the entry
        cached = db_session.query(models.Cache).filter(
            models.Cache.prompt_hash == cache_service._hash(key)
        ).first()
        if cached:
            cached.expired_at = utcnow()
            db_session.commit()

        result = cache_service.get_cache(db_session, key, "", "")
        assert result is None