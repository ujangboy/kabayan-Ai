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

    Catatan: Fungsi ini menyimpan topik tanpa tag subject (legacy).
    Gunakan update_topics_for_subject() untuk sinkronisasi yang lebih akurat.
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


def update_topics_for_subject(
    db: Session,
    subject_id: int,
    weak: list[str],
    strong: list[str],
) -> TutorUserProfile:
    """
    Sinkronisasi topik lemah/kuat dari LearningProfile (per subject) ke
    TutorUserProfile — dengan format tagged agar tidak bercampur antar matkul.

    Format yang disimpan: {"subject_id": int, "topics": [str, ...]}
    stored as JSON list of tagged objects.

    Subject lain tidak terpengaruh — hanya entry dengan subject_id ini yang di-replace.
    """
    profile = get_or_create_profile(db)

    def _merge_tagged(
        current_json: Optional[str], sid: int, new_topics: list[str]
    ) -> str:
        """Update/insert tagged entry untuk subject_id ini."""
        try:
            current = json.loads(current_json or "[]")
            if not isinstance(current, list):
                current = []
        except (json.JSONDecodeError, TypeError):
            current = []

        # Pisahkan entry milik subject ini vs subject lain
        other = [e for e in current if not (isinstance(e, dict) and e.get("subject_id") == sid)]
        if new_topics:
            other.append({"subject_id": sid, "topics": new_topics})
        return json.dumps(other, ensure_ascii=False)

    profile.weak_topics   = _merge_tagged(profile.weak_topics,   subject_id, weak)
    profile.strong_topics = _merge_tagged(profile.strong_topics, subject_id, strong)
    profile.updated_at    = datetime.datetime.utcnow()
    db.commit()
    db.refresh(profile)
    return profile


def _flatten_tagged_topics(topics_json: Optional[str]) -> list[str]:
    """
    Flatten tagged topics (list of {subject_id, topics}) OR legacy flat list.
    Digunakan oleh get_adaptive_instructions untuk backward compatibility.
    """
    if not topics_json:
        return []
    try:
        data = json.loads(topics_json)
        if not isinstance(data, list):
            return []
        flat = []
        for entry in data:
            if isinstance(entry, str):
                flat.append(entry)          # legacy format
            elif isinstance(entry, dict):
                flat.extend(entry.get("topics", []))  # tagged format
        return flat
    except (json.JSONDecodeError, TypeError):
        return []


def get_adaptive_instructions(
    profile: TutorUserProfile,
    subject_profile: Optional[dict] = None,
) -> str:
    """
    Return additional prompt instructions based on profile settings.

    subject_profile: optional dict {"subject": str, "weak": [..], "strong": [..]}
    dari LearningProfile mata kuliah yang sedang dibahas. Jika ada, topik
    lemah/kuat per materi DIPRIORITASKAN (tidak mencampur topik matkul lain).
    """
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

    # Topik lemah/kuat: utamakan profil per mata kuliah jika tersedia
    if subject_profile and (subject_profile.get("weak") or subject_profile.get("strong")):
        weak = subject_profile.get("weak", [])
        strong = subject_profile.get("strong", [])
        if weak:
            parts.append(
                "Berdasarkan hasil ujian di mata kuliah ini, siswa sering kesulitan "
                "dengan: "
                + ", ".join(weak[:5])
                + ". Berikan perhatian ekstra dan contoh tambahan untuk topik ini."
            )
        if strong:
            parts.append(
                "Berdasarkan hasil ujian di mata kuliah ini, siswa sudah menguasai: "
                + ", ".join(strong[:5])
                + ". Jangan mengulang penjelasan dasar topik ini; bisa langsung "
                "melaju ke tingkat lanjutan atau soal yang lebih menantang."
            )
    else:
        # Fallback ke profil global, flatten dari format tagged maupun legacy
        weak = _flatten_tagged_topics(profile.weak_topics)
        if weak:
            parts.append(
                "Siswa sering kesulitan dengan: "
                + ", ".join(weak[:5])
                + ". Berikan perhatian ekstra pada topik ini."
            )
    return "\n".join(parts)


def build_adaptive_prompt_section(
    profile: TutorUserProfile | None,
    subject_profile: Optional[dict] = None,
) -> str:
    """Build a full adaptive section to inject into the tutor system prompt."""
    if profile is None:
        return ""
    instructions = get_adaptive_instructions(profile, subject_profile=subject_profile)
    if not instructions:
        return ""
    return (
        "\n\n==================================================\n"
        "PENGATURAN PERSONALISASI SISWA\n"
        "==================================================\n"
        f"{instructions}\n"
    )