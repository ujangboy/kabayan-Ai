"""
Diagnostic Engine (PRD US4.2) — analisis kekuatan/kelemahan + resep perbaikan.

Stateless & deterministik (0 token LLM): membaca Learning Profile, QuestionBank,
FSRS, dan metrik kelelahan lalu menyusun:
  - readiness       : seberapa siap ujian (rata-rata mastery topik tertutup)
  - weak/strong     : topik lemah & kuat dengan detail + trend
  - no_data_topics  : topik di bank yang belum pernah dilatih (cold start)
  - action_items    : 3 resep prioritas — tiap resep memilih modalitas sesuai
                      tingkat penguasaan (Socratic <40%, Micro-Quiz 40–69%,
                      Flashcard jika ≥70% tapi menurun)
  - risk_flags      : kelelahan berat, streak salah panjang, retensi rendah,
                      beban FSRS tinggi

Output siap dikonsumsi frontend (kartu Diagnostic di Subject Dashboard).
"""
from __future__ import annotations

import json
import logging
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from engines.learning_metrics import compute_fatigue, compute_fsrs_overview
from engines.knowledge_graph import WEAK_THRESHOLD, _load_json, _trend_direction

logger = logging.getLogger(__name__)

CORRECTIVE_LOW = 40   # < 40% → konsep dasar belum ada → tutor socratic
CORRECTIVE_MED = 70   # 40–69% → latihan terstruktur → micro-quiz
STREAK_RISK = 4       # streak jawaban salah > 4 → risiko
RETENTION_RISK = 70   # retensi FSRS < 70% → risiko
FSRS_DUE_RATIO_RISK = 0.4  # proporsi kartu due+baru > 40% → beban menumpuk


def _prescribe(accuracy: Optional[int], trend: str) -> Dict:
    """Pilih modalitas remedial berdasarkan tingkat penguasaan (deterministik)."""
    if accuracy is None:
        return {
            "modality": "micro_quiz",
            "to": "/quiz",
            "reason": "Belum pernah diuji — kenali lewat micro-quiz ringan.",
        }
    if accuracy < CORRECTIVE_LOW:
        return {
            "modality": "socratic",
            "to": "/chat",
            "reason": f"Mastery {accuracy}% — konsep dasar belum terbentuk, diskusikan dengan tutor Socratic.",
        }
    if accuracy < CORRECTIVE_MED:
        return {
            "modality": "micro_quiz",
            "to": "/quiz",
            "reason": f"Mastery {accuracy}% — butuh latihan terstruktur lewat micro-quiz.",
        }
    if trend == "turun":
        return {
            "modality": "flashcard",
            "to": "/flashcard",
            "reason": f"Mastery {accuracy}% tapi tren menurun — sematkan dengan review flashcard.",
        }
    return {"modality": None, "to": None, "reason": None}


def run_diagnostic(db: Session, subject_id: Optional[int] = None) -> Dict:
    """Susun diagnostic per mata kuliah (subject_id=None → gabungan semua)."""
    import models

    lp = None
    if subject_id is not None:
        lp = (
            db.query(models.LearningProfile)
            .filter_by(user_key="local", subject_id=subject_id)
            .first()
        )

    mastery = _load_json(lp.topics_mastery, {}) if lp else {}
    weak_names = set(_load_json(lp.weak_topics, []) or []) if lp else set()
    strong_names = set(_load_json(lp.strong_topics, []) or []) if lp else set()
    trends = _load_json(lp.topic_trend_json, {}) if lp else {}

    bank_query = db.query(models.QuestionBank)
    if subject_id is not None:
        bank_query = bank_query.filter(models.QuestionBank.subject_id == subject_id)
    bank_topics = sorted({
        (r.topic or "").strip()
        for r in bank_query.all()
        if (r.topic or "").strip()
    })

    # ── Detail per topik ──
    weak_topics: List[Dict] = []
    strong_topics: List[Dict] = []
    no_data_topics: List[str] = []
    covered_accuracies: List[int] = []

    for name in sorted(set(mastery.keys()) | set(bank_topics)):
        m = mastery.get(name, {})
        accuracy = m.get("accuracy") if isinstance(m, dict) else None
        attempts = m.get("attempts", 0) if isinstance(m, dict) else 0
        sessions = m.get("sessions", 0) if isinstance(m, dict) else 0
        trend = _trend_direction(trends.get(name) or [])

        if accuracy is None:
            if name in bank_topics:
                no_data_topics.append(name)
            continue

        covered_accuracies.append(accuracy)
        detail = {
            "topic": name,
            "accuracy": int(accuracy),
            "attempts": int(attempts),
            "sessions": int(sessions),
            "trend_direction": trend,
            "corrective": _prescribe(int(accuracy), trend),
        }
        is_weak = name in weak_names or accuracy < WEAK_THRESHOLD
        if is_weak and (name in weak_names or accuracy < CORRECTIVE_MED or trend == "turun"):
            weak_topics.append(detail)
        elif name in strong_names or accuracy >= WEAK_THRESHOLD:
            strong_topics.append(detail)

    weak_topics.sort(key=lambda d: (d["accuracy"], d["trend_direction"] != "turun"))
    strong_topics.sort(key=lambda d: -d["accuracy"])

    # ── Readiness ──
    avg_mastery = (
        round(sum(covered_accuracies) / len(covered_accuracies))
        if covered_accuracies
        else None
    )
    if avg_mastery is None:
        readiness = {"level": "belum_ada_data", "label": None, "avg_mastery": None}
    elif avg_mastery >= 75:
        readiness = {"level": "siap_ujian", "label": "Siap ujian", "avg_mastery": avg_mastery}
    elif avg_mastery >= 60:
        readiness = {"level": "perlu_persiapan", "label": "Perlu persiapan", "avg_mastery": avg_mastery}
    else:
        readiness = {"level": "perlu_banyak_latihan", "label": "Perlu banyak latihan", "avg_mastery": avg_mastery}

    # ── Risiko (FSRS + kelelahan) ──
    fsrs = compute_fsrs_overview(db, subject_id)
    fatigue = compute_fatigue(db, subject_id)
    risk_flags: List[Dict] = []
    if fatigue.get("level") == "berat":
        risk_flags.append({
            "code": "fatigue_heavy",
            "severity": "tinggi",
            "message": "Akurasi turun drastis pada sesi panjang — batasi sesi dan istirahat.",
        })
    if (fatigue.get("max_consecutive_wrong") or 0) > STREAK_RISK:
        risk_flags.append({
            "code": "wrong_streak",
            "severity": "sedang",
            "message": f"Ada streak {fatigue['max_consecutive_wrong']} jawaban salah berturut-turut — ulangi konsep terkait.",
        })
    if fsrs.get("retention_pct") is not None and fsrs["retention_pct"] < RETENTION_RISK:
        risk_flags.append({
            "code": "low_retention",
            "severity": "sedang",
            "message": f"Retensi FSRS {fsrs['retention_pct']}% (di bawah {RETENTION_RISK}%) — perbanyak review flashcard.",
        })
    total_cards = fsrs.get("total_cards") or 0
    pending_ratio = (fsrs.get("due_cards", 0) + fsrs.get("new_cards", 0)) / total_cards if total_cards else 0
    if pending_ratio > FSRS_DUE_RATIO_RISK:
        risk_flags.append({
            "code": "fsrs_backlog",
            "severity": "rendah",
            "message": f"Beban flashcard menumpuk ({round(pending_ratio * 100)}% kartu due/belum dipelajari).",
        })

    # ── Action items: 3 resep prioritas ──
    action_items: List[Dict] = []
    for d in weak_topics:
        if not d["corrective"]["modality"]:
            continue
        action_items.append({
            "topic": d["topic"],
            "modality": d["corrective"]["modality"],
            "to": d["corrective"]["to"],
            "reason": d["corrective"]["reason"],
            "accuracy": d["accuracy"],
            "trend_direction": d["trend_direction"],
        })
        if len(action_items) >= 3:
            break
    if not action_items:
        if no_data_topics:
            action_items.append({
                "topic": no_data_topics[0],
                "modality": "micro_quiz",
                "to": "/quiz",
                "reason": "Belum ada data latihan — mulai dari topik yang belum pernah diuji.",
                "accuracy": None,
                "trend_direction": "stabil",
            })
        else:
            action_items.append({
                "topic": None,
                "modality": "flashcard",
                "to": "/flashcard",
                "reason": "Semua topik tertutup dan stabil — pertahankan dengan review flashcard berkala.",
                "accuracy": None,
                "trend_direction": "stabil",
            })

    return {
        "subject_id": subject_id,
        "readiness": readiness,
        "overview": {
            "estimated_level": lp.estimated_level if lp else 0,
            "total_sessions": lp.total_sessions if lp else 0,
            "total_questions": lp.total_questions if lp else 0,
            "topics_covered": len(covered_accuracies),
            "topics_in_bank": len(bank_topics),
            "coverage_pct": (
                round(len(covered_accuracies) / len(bank_topics) * 100) if bank_topics else 0
            ),
        },
        "weak_topics": weak_topics,
        "strong_topics": strong_topics[:5],
        "no_data_topics": no_data_topics[:5],
        "action_items": action_items,
        "risk_flags": risk_flags,
    }
