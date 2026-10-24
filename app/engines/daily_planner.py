"""
Daily Planner (PRD US4.3) — plan_generator harian.

Setiap pagi sistem menyusun jadwal belajar HARI INI berdasarkan:
  1. FSRS overdue — kartu jatuh tempo (next_review <= now) & kartu baru
  2. Konsep dengan Mastery Score terendah (LearningProfile / ujian terakhir)
  3. Waktu luang user (free_minutes)
  4. Jam terbaik belajar (learning metrics US3.3)

Desain: stateless & real-time — hasil dihitung ulang tiap request, tanpa
tabel baru (sama pola dengan learning_metrics). Murni Python, deterministik,
sesuai Workflow A PRD: buka aplikasi pagi → plan hari ini siap.

Prioritas pengisian slot waktu:
  flashcard (due/new FSRS) → remedial topik lemah → latihan tambahan (quiz/socratic).
"""
from __future__ import annotations

import datetime
from app.time_utils import utcnow
import json
import logging
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.engines.learning_metrics import compute_optimal_time

logger = logging.getLogger(__name__)

SECONDS_PER_FLASHCARD = 30          # estimasi 30 detik/kartu
MAX_FLASHCARD_MINUTES = 20          # cap sesi flashcard per subject
MINUTES_PER_REMEDIAL = 15           # durasi remedial topik lemah
MINUTES_PER_PRACTICE = 10           # durasi latihan tambahan
WEAK_MASTERY_THRESHOLD = 70         # mastery < 70 → topik lemah


def _load_json(text: Optional[str], fallback):
    if not text:
        return fallback
    try:
        data = json.loads(text)
        return data if data is not None else fallback
    except (json.JSONDecodeError, TypeError):
        return fallback


def _subject_items(db: Session, subject_id: int) -> Dict:
    """Kumpulkan bahan plan untuk satu mata kuliah: FSRS + mastery."""
    from app import models

    now = utcnow()

    cards = (
        db.query(models.Flashcard)
        .filter(models.Flashcard.subject_id == subject_id)
        .all()
    )
    due_count = 0
    new_count = 0
    for c in cards:
        if (c.times_seen or 0) == 0:
            new_count += 1
        elif c.next_review is None or c.next_review <= now:
            due_count += 1

    weak_topics: List[Dict] = []
    lp = (
        db.query(models.LearningProfile)
        .filter_by(user_key="local", subject_id=subject_id)
        .first()
    )
    if lp:
        mastery = _load_json(lp.topics_mastery, {})
        weak = _load_json(lp.weak_topics, [])
        if isinstance(mastery, dict) and isinstance(weak, list):
            for topic in weak[:3]:
                acc = mastery.get(topic, {}).get("accuracy", 0)
                weak_topics.append({"topic": topic, "accuracy": int(acc)})

    return {
        "due_count": due_count,
        "new_count": new_count,
        "weak_topics": weak_topics,
    }


def generate_daily_plan(
    db: Session,
    free_minutes: int = 60,
    subject_id: Optional[int] = None,
) -> Dict:
    """Susun rencana belajar hari ini; kembalikan daftar item + ringkasan."""
    from app import models

    free_minutes = max(5, min(480, int(free_minutes or 60)))
    now = utcnow()
    plan: List[Dict] = []
    used = 0

    subjects = db.query(models.Subject)
    if subject_id is not None:
        subjects = subjects.filter(models.Subject.id == subject_id)
    subjects = subjects.all()

    # ── Tahap 1: FSRS (kartu due + baru) ──
    if used < free_minutes:
        for subj in subjects:
            if used >= free_minutes:
                break
            data = _subject_items(db, subj.id)
            pending = data["due_count"] + data["new_count"]
            if not pending:
                continue
            est = round(pending * SECONDS_PER_FLASHCARD / 60)
            duration = min(est, MAX_FLASHCARD_MINUTES, free_minutes - used)
            if duration < 1:
                duration = 1
            parts = []
            if data["new_count"]:
                parts.append(f"{data['new_count']} kartu baru")
            if data["due_count"]:
                parts.append(f"{data['due_count']} kartu jatuh tempo")
            plan.append({
                "type": "flashcard",
                "subject_id": subj.id,
                "subject_name": subj.name,
                "topic": None,
                "duration_minutes": duration,
                "reason": f"{', '.join(parts)} (FSRS)",
                "source": "fsrs",
            })
            used += duration

    # ── Tahap 2: remedial topik lemah (mastery terendah) ──
    if used < free_minutes:
        from app.engines.modality_router import route as modality_route

        for subj in subjects:
            if used >= free_minutes:
                break
            data = _subject_items(db, subj.id)
            for wt in data["weak_topics"]:
                if used >= free_minutes:
                    break
                duration = min(MINUTES_PER_REMEDIAL, free_minutes - used)
                if duration < 1:
                    continue
                try:
                    rec = modality_route(db, subj.id, "MEDIUM")
                    practice_type = rec["modality"]  # micro_quiz / socratic
                except ValueError:
                    practice_type = "socratic"
                plan.append({
                    "type": practice_type,
                    "subject_id": subj.id,
                    "subject_name": subj.name,
                    "topic": wt["topic"],
                    "duration_minutes": duration,
                    "reason": f"Mastery topik '{wt['topic']}' {wt['accuracy']}% (di bawah {WEAK_MASTERY_THRESHOLD}%)",
                    "source": "mastery",
                })
                used += duration

    # ── Tahap 3: latihan tambahan (isi sisa waktu) ──
    if used < free_minutes:
        from app.engines.modality_router import route as modality_route

        for subj in subjects:
            if used >= free_minutes:
                break
            try:
                rec = modality_route(db, subj.id, "MEDIUM")
            except ValueError:
                continue
            if rec["modality"] == "socratic" and rec["resources"]["quizzes_total"] == 0:
                continue  # tanpa resource nyata, jangan paksakan item kosong
            duration = min(MINUTES_PER_PRACTICE, free_minutes - used)
            if duration < 1:
                continue
            plan.append({
                "type": rec["modality"],
                "subject_id": subj.id,
                "subject_name": subj.name,
                "topic": None,
                "duration_minutes": duration,
                "reason": f"Latihan tambahan ({rec['modality_label']})",
                "source": "practice",
            })
            used += duration

    best = compute_optimal_time(db, subject_id)
    total_used = sum(i["duration_minutes"] for i in plan)

    return {
        "generated_for": now.date().isoformat(),
        "generated_at": now.isoformat(),
        "free_minutes": free_minutes,
        "total_duration_minutes": total_used,
        "best_hour": best["best_hour"],
        "subject_id": subject_id,
        "items": plan,
        "empty_reason": (
            None if plan else
            "Belum ada kartu jatuh tempo maupun topik lemah — hari ini bebas, "
            "coba pelajari materi baru atau buat flashcard."
        ),
    }
