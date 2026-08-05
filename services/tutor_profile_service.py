"""
Tutor Profile Service — manages adaptive learning profile for the single-user
local Kabayan AI Tutor app.

The profile is a singleton identified by user_key="local" (no users table).
It influences tutor prompt adaptation and tracks usage statistics.
"""
import json
import logging
import datetime
from typing import Optional

from sqlalchemy.orm import Session

from models import TutorUserProfile

logger = logging.getLogger(__name__)

USER_KEY = "local"

VALID_DEPTHS = ("brief", "medium", "detailed")
VALID_LENGTHS = ("short", "medium", "long")


def get_or_create_profile(db: Session) -> TutorUserProfile:
    """Return the singleton profile, creating it on first access."""
    profile = db.query(TutorUserProfile).filter_by(user_key=USER_KEY).first()
    if profile is None:
        profile = TutorUserProfile(user_key=USER_KEY)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def update_after_feedback(db: Session, rating: str) -> TutorUserProfile:
    """Increment helpful/not-helpful counters and recalc helpful_rate."""
    profile = get_or_create_profile(db)
    if rating == "helpful":
        profile.helpful_count += 1
    elif rating == "not_helpful":
        profile.not_helpful_count += 1
    total = profile.helpful_count + profile.not_helpful_count
    profile.helpful_rate = (
        round(profile.helpful_count / total * 100, 1) if total > 0 else None
    )
    profile.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(profile)
    return profile


def record_session(db: Session) -> TutorUserProfile:
    """Increment total_sessions counter."""
    profile = get_or_create_profile(db)
    profile.total_sessions += 1
    db.commit()
    db.refresh(profile)
    return profile


def record_message(db: Session, tokens: int = 0) -> TutorUserProfile:
    """Increment total_messages and tokens counters."""
    profile = get_or_create_profile(db)
    profile.total_messages += 1
    profile.total_tokens += tokens
    db.commit()
    db.refresh(profile)
    return profile


def update_topics(db: Session, topics: list[str], strength: str) -> TutorUserProfile:
    """
    Merge a topic into weak_topics or strong_topics JSON list.

    strength: "weak" or "strong"
    """
    profile = get_or_create_profile(db)
    key = "weak_topics" if strength == "weak" else "strong_topics"
    current = json.loads(getattr(profile, key) or "[]")
    if not isinstance(current, list):
        current = []
    if topics:
        for t in topics:
            if t not in current:
                current.append(t)
    setattr(profile, key, json.dumps(current))
    db.commit()
    db.refresh(profile)
    return profile


def get_adaptive_instructions(profile: TutorUserProfile) -> str:
    """Return additional prompt instructions based on profile settings."""
    parts = []
    if profile.explanation_depth == "brief":
        parts.append("Berikan penjelasan singkat dan ringkas.")
    elif profile.explanation_depth == "detailed":
        parts.append("Berikan penjelasan mendalam dengan detail penuh.")
    if profile.response_length == "short":
        parts.append("Jawab secara ringkas (maks 3 paragraf).")
    elif profile.response_length == "long":
        parts.append("Berikan jawaban lengkap dengan penjelasan detail.")
    if not profile.use_formulas:
        parts.append("Jangan gunakan rumus matematika formal atau notasi LaTeX.")
    if not profile.use_examples:
        parts.append("Jangan sertakan contoh konkret.")
    if not profile.use_step_by_step:
        parts.append("Jangan pecah penjelasan menjadi langkah-langkah bertahap.")
    if profile.weak_topics:
        try:
            weak = json.loads(profile.weak_topics)
            if weak:
                parts.append(
                    "Siswa sering kesulitan dengan: "
                    + ", ".join(weak[:5])
                    + ". Berikan perhatian ekstra pada topik ini."
                )
        except (json.JSONDecodeError, TypeError):
            pass
    return "\n".join(parts)


def build_adaptive_prompt_section(profile: TutorUserProfile) -> str:
    """Build a full adaptive section to inject into the tutor system prompt."""
    instructions = get_adaptive_instructions(profile)
    if not instructions:
        return ""
    return (
        "\n\n==================================================\n"
        "PENGATURAN PERSONALISASI SISWA\n"
        "==================================================\n"
        f"{instructions}\n"
    )