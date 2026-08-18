"""
Modality Router (PRD US3.2) — memilih modalitas belajar dari kompleksitas materi.

Mapping tier → modalitas:
    SIMPLE   → flashcard    (hafalan fakta/konsep singkat)
    MEDIUM   → micro_quiz   (kuis singkat untuk menguji pemahaman)
    COMPLEX  → socratic     (tutor Socratic via LLM, menjelaskan konsep rumit)

Jika sumber daya modalitas utama belum tersedia untuk mata kuliah tersebut,
lakukan fallback:
    SIMPLE (tanpa flashcard)  → micro_quiz (jika ada quiz) → socratic
    MEDIUM (tanpa quiz)       → socratic
    COMPLEX                   → socratic (selalu tersedia — LLM)

Murni logika (tanpa side-effect), agar mudah diuji & dipakai oleh endpoint.
"""
from __future__ import annotations

import datetime
from time_utils import utcnow
from typing import Dict, Optional

MODALITY_BY_TIER: Dict[str, str] = {
    "SIMPLE": "flashcard",
    "MEDIUM": "micro_quiz",
    "COMPLEX": "socratic",
}

VALID_TIERS = tuple(MODALITY_BY_TIER.keys())

MODALITY_LABELS = {
    "flashcard": "Flashcard",
    "micro_quiz": "Micro-Quiz",
    "socratic": "Tutor Socratic",
}


def collect_resources(db, subject_id: int) -> Dict:
    """Snapshot sumber daya latihan untuk satu mata kuliah."""
    import models

    now = utcnow()
    flashcards_total = (
        db.query(models.Flashcard).filter(models.Flashcard.subject_id == subject_id).count()
    )
    flashcards_due = (
        db.query(models.Flashcard)
        .filter(
            models.Flashcard.subject_id == subject_id,
            (models.Flashcard.next_review.is_(None)) | (models.Flashcard.next_review <= now),
        )
        .count()
    )
    quizzes_total = (
        db.query(models.Quiz)
        .filter(
            models.Quiz.subject_id == subject_id,
            models.Quiz.questions_json.isnot(None),
            models.Quiz.questions_json != "",
        )
        .count()
    )
    return {
        "flashcards_total": flashcards_total,
        "flashcards_due": flashcards_due,
        "quizzes_total": quizzes_total,
    }


def route(db, subject_id: int, tier: str, topic: Optional[str] = None) -> Dict:
    """Rekomendasikan modalitas belajar untuk (mata kuliah, tier, topik)."""
    tier = str(tier).strip().upper()
    if tier not in MODALITY_BY_TIER:
        raise ValueError(
            f"Tier tidak dikenal: '{tier}'. Pilihan: {', '.join(VALID_TIERS)}."
        )

    resources = collect_resources(db, subject_id)
    target = MODALITY_BY_TIER[tier]
    modality = target
    reason = ""

    if target == "flashcard":
        if resources["flashcards_total"] > 0:
            due = resources["flashcards_due"]
            reason = (
                f"Topik sederhana → latihan hafalan. {due} kartu jatuh tempo untuk diulang."
                if due
                else "Topik sederhana → latihan hafalan (semua kartu sudah direview hari ini)."
            )
        elif resources["quizzes_total"] > 0:
            modality = "micro_quiz"
            reason = "Belum ada flashcard untuk mata kuliah ini — turun ke micro-quiz sebagai gantinya."
        else:
            modality = "socratic"
            reason = "Belum ada flashcard maupun quiz — tutor Socratic menjelaskan topik langsung."

    elif target == "micro_quiz":
        if resources["quizzes_total"] > 0:
            reason = "Topik menengah → uji pemahaman dengan micro-quiz singkat."
        else:
            modality = "socratic"
            reason = "Belum ada quiz untuk mata kuliah ini — tutor Socratic membahas konsep langsung."

    else:  # socratic
        reason = "Topik kompleks → tutor Socratic membimbing langkah demi langkah."

    return {
        "subject_id": subject_id,
        "tier": tier,
        "topic": topic,
        "modality": modality,
        "modality_label": MODALITY_LABELS[modality],
        "reason": reason,
        "resources": resources,
    }


modality_router = None  # kompatibilitas import lama (tidak dipakai)
