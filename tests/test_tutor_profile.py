"""
Integration test untuk services/tutor_profile_service.py + GET /api/tutor/profile.
"""
import pytest

import models
from services.tutor_profile_service import (
    get_or_create_profile,
    update_after_feedback,
    record_message,
    get_adaptive_instructions,
    build_adaptive_prompt_section,
)
from routers.tutor import get_tutor_profile, TutorChatRequest
import asyncio


# ─── Fixture ──────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _clean_profile(db_session):
    db_session.query(models.TutorUserProfile).delete()
    db_session.commit()
    yield
    db_session.query(models.TutorUserProfile).delete()
    db_session.commit()


# ─── get_or_create_profile ────────────────────────────────────────────

def test_get_or_create_profile_creates_new(db_session):
    profile = get_or_create_profile(db_session)
    assert profile is not None
    assert profile.user_key == "local"
    assert profile.estimated_level == 50
    assert profile.explanation_depth == "medium"
    assert profile.response_length == "medium"
    assert profile.use_formulas is True
    assert profile.use_examples is True
    assert profile.use_step_by_step is True


def test_get_or_create_profile_returns_existing(db_session):
    p1 = get_or_create_profile(db_session)
    p1.estimated_level = 75
    db_session.commit()

    p2 = get_or_create_profile(db_session)
    assert p2.id == p1.id
    assert p2.estimated_level == 75


# ─── update_after_feedback ────────────────────────────────────────────

def test_update_after_feedback_helpful(db_session):
    profile = get_or_create_profile(db_session)
    result = update_after_feedback(db_session, "helpful")
    assert result.helpful_count == 1
    assert result.not_helpful_count == 0
    assert result.helpful_rate == 100.0


def test_update_after_feedback_not_helpful(db_session):
    profile = get_or_create_profile(db_session)
    update_after_feedback(db_session, "helpful")
    update_after_feedback(db_session, "not_helpful")
    result = update_after_feedback(db_session, "not_helpful")
    assert result.helpful_count == 1
    assert result.not_helpful_count == 2
    assert result.helpful_rate == 33.3


# ─── record_message ───────────────────────────────────────────────────

def test_record_message_increments_counters(db_session):
    profile = get_or_create_profile(db_session)
    assert profile.total_messages == 0
    assert profile.total_tokens == 0

    record_message(db_session, tokens=150)
    assert profile.total_messages == 1
    assert profile.total_tokens == 150

    record_message(db_session, tokens=300)
    assert profile.total_messages == 2
    assert profile.total_tokens == 450


# ─── get_adaptive_instructions ────────────────────────────────────────

def test_get_adaptive_instructions_brief(db_session):
    profile = get_or_create_profile(db_session)
    profile.explanation_depth = "brief"
    db_session.commit()

    instructions = get_adaptive_instructions(profile)
    assert "singkat" in instructions.lower() or "ringkas" in instructions.lower()


def test_get_adaptive_instructions_no_formulas(db_session):
    profile = get_or_create_profile(db_session)
    profile.use_formulas = False
    db_session.commit()

    instructions = get_adaptive_instructions(profile)
    assert "LaTeX" in instructions or "rumus" in instructions.lower()


def test_get_adaptive_instructions_weak_topics(db_session):
    profile = get_or_create_profile(db_session)
    profile.weak_topics = '["Limit", "Turunan"]'
    db_session.commit()

    instructions = get_adaptive_instructions(profile)
    assert "Limit" in instructions
    assert "Turunan" in instructions


def test_get_adaptive_instructions_empty(db_session):
    profile = get_or_create_profile(db_session)
    instructions = get_adaptive_instructions(profile)
    assert instructions == ""


# ─── build_adaptive_prompt_section ────────────────────────────────────

def test_build_adaptive_prompt_section_returns_string(db_session):
    profile = get_or_create_profile(db_session)
    profile.explanation_depth = "detailed"
    profile.use_examples = False
    db_session.commit()

    section = build_adaptive_prompt_section(profile)
    assert isinstance(section, str)
    assert len(section) > 0
    assert "PENGATURAN PERSONALISASI" in section


def test_build_adaptive_prompt_section_empty_when_no_settings(db_session):
    profile = get_or_create_profile(db_session)
    section = build_adaptive_prompt_section(profile)
    assert section == ""


# ─── GET /api/tutor/profile endpoint ──────────────────────────────────

def test_profile_endpoint_returns_json(db_session):
    get_or_create_profile(db_session)

    from fastapi.testclient import TestClient
    from main import app

    client = TestClient(app)
    response = client.get("/api/tutor/profile")
    assert response.status_code == 200
    data = response.json()
    assert data["user_key"] == "local"
    assert data["estimated_level"] == 50
    assert data["use_formulas"] is True


def test_profile_endpoint_creates_profile_if_missing(db_session):
    from fastapi.testclient import TestClient
    from main import app

    client = TestClient(app)
    response = client.get("/api/tutor/profile")
    assert response.status_code == 200
    data = response.json()
    assert data["user_key"] == "local"