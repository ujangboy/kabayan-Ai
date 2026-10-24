"""
Knowledge Graph Engine (PRD US4.1) — peta konsep & keterkaitan topik per mata kuliah.

Dibangun real-time & stateless dari data yang SUDAH ada (0 token LLM, tanpa
tabel baru, sesuai keputusan arsitektur 8GB):
  - topik nodes  : QuestionBank.topic + LearningProfile.topics_mastery
  - bab nodes    : QuestionBank.chapter (label bab/bab materi)
  - konsep       : key_concepts dari blueprint ujian terbaru (atribut topik)
  - edge contains   : topik → bab (dari baris question bank)
  - edge depends_on : topik → topik (ko-okurensi dalam material_ref yang sama,
                      dianggap prasyarat/saling terkait)

Bobot tiap topik menyatu dengan Learning Profile (mastery/attempts/trend) dan
prioritas dari blueprint terbaru — input untuk Diagnostic (US4.2) dan planner.
"""
from __future__ import annotations

import datetime
import json
import logging
from collections import defaultdict
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

WEAK_THRESHOLD = 70  # mastery < 70 → topik lemah (selaras daily planner)


def _load_json(text: Optional[str], fallback):
    if not text:
        return fallback
    try:
        data = json.loads(text)
        return data if data is not None else fallback
    except (json.JSONDecodeError, TypeError):
        return fallback


def _trend_direction(series: List) -> str:
    """Naik/turun/stabil dari deret akurasi per sesi (sesi terakhir > pertama)."""
    if not series or len(series) < 2:
        return "stabil"
    try:
        values = [float(v) for v in series if v is not None]
    except (TypeError, ValueError):
        return "stabil"
    if len(values) < 2:
        return "stabil"
    delta = values[-1] - values[0]
    if delta >= 5:
        return "naik"
    if delta <= -5:
        return "turun"
    return "stabil"


def build_knowledge_graph(db: Session, subject_id: Optional[int] = None) -> Dict:
    """Bangun knowledge graph dari QuestionBank + LearningProfile + blueprint."""
    from app import models

    bank_rows = db.query(models.QuestionBank)
    if subject_id is not None:
        bank_rows = bank_rows.filter(models.QuestionBank.subject_id == subject_id)
    bank_rows = bank_rows.all()

    lp = None
    if subject_id is not None:
        lp = (
            db.query(models.LearningProfile)
            .filter_by(user_key="local", subject_id=subject_id)
            .first()
        )

    mastery = _load_json(lp.topics_mastery, {}) if lp else {}
    weak = set(_load_json(lp.weak_topics, []) or []) if lp else set()
    strong = set(_load_json(lp.strong_topics, []) or []) if lp else set()
    trends = _load_json(lp.topic_trend_json, {}) if lp else {}

    # ── Topik & bab dari question bank ──
    topics: Dict[str, Dict] = {}
    bab_topics: Dict[str, set] = defaultdict(set)
    material_groups: Dict[str, set] = defaultdict(set)  # material_ref → {topik}

    for row in bank_rows:
        topic = (row.topic or "").strip()
        if not topic:
            continue
        t = topics.setdefault(topic, {
            "id": topic,
            "label": topic,
            "type": "topik",
            "questions_in_bank": 0,
            "chapters": set(),
            "concepts": set(),
            "in_latest_blueprint": False,
        })
        t["questions_in_bank"] += 1
        if row.chapter:
            chapter = row.chapter.strip()
            if chapter:
                t["chapters"].add(chapter)
                bab_topics[chapter].add(topic)
        if row.material_ref:
            material_groups[row.material_ref].add(topic)

    # ── Konsep kunci dari blueprint terbaru ──
    if subject_id is not None:
        latest_bp = (
            db.query(models.ExamBlueprint)
            .filter(models.ExamBlueprint.subject_id == subject_id)
            .order_by(models.ExamBlueprint.created_at.desc())
            .first()
        )
        if latest_bp and latest_bp.blueprint_json:
            bp_data = _load_json(latest_bp.blueprint_json, {})
            for item in bp_data.get("blueprint_items", []):
                topic = (item.get("topic") or "").strip()
                if not topic:
                    continue
                t = topics.setdefault(topic, {
                    "id": topic,
                    "label": topic,
                    "type": "topik",
                    "questions_in_bank": 0,
                    "chapters": set(),
                    "concepts": set(),
                    "in_latest_blueprint": False,
                })
                t["in_latest_blueprint"] = True
                for concept in item.get("key_concepts") or []:
                    concept = str(concept).strip()
                    if concept:
                        t["concepts"].add(concept)

    # ── Bobot dari Learning Profile ──
    all_topic_names = set(topics.keys()) | set(mastery.keys())
    for name in sorted(all_topic_names):
        t = topics.setdefault(name, {
            "id": name,
            "label": name,
            "type": "topik",
            "questions_in_bank": 0,
            "chapters": set(),
            "concepts": set(),
            "in_latest_blueprint": False,
        })
        m = mastery.get(name, {})
        accuracy = m.get("accuracy") if isinstance(m, dict) else None
        t["mastery"] = int(accuracy) if accuracy is not None else None
        t["attempts"] = m.get("attempts", 0) if isinstance(m, dict) else 0
        t["sessions"] = m.get("sessions", 0) if isinstance(m, dict) else 0
        t["trend_direction"] = _trend_direction(trends.get(name) or [])
        t["trend_series"] = trends.get(name) or []
        if name in weak:
            t["status"] = "lemah"
        elif name in strong:
            t["status"] = "kuat"
        elif t["mastery"] is None:
            t["status"] = "tanpa_data"
        elif t["mastery"] < WEAK_THRESHOLD:
            t["status"] = "lemah"
        else:
            t["status"] = "normal"

    # ── Nodes & edges ──
    nodes = []
    for name, t in topics.items():
        nodes.append({
            "id": t["id"],
            "label": t["label"],
            "type": "topik",
            "mastery": t["mastery"],
            "status": t["status"],
            "attempts": t["attempts"],
            "sessions": t["sessions"],
            "trend_direction": t["trend_direction"],
            "questions_in_bank": t["questions_in_bank"],
            "concepts": sorted(t["concepts"]),
            "in_latest_blueprint": t["in_latest_blueprint"],
        })

    edges: List[Dict] = []
    for chapter, topic_set in sorted(bab_topics.items()):
        members = sorted(topic_set)
        avg_mastery = None
        accuracies = [topics[t]["mastery"] for t in members if topics[t]["mastery"] is not None]
        if accuracies:
            avg_mastery = round(sum(accuracies) / len(accuracies))
        nodes.append({
            "id": f"bab:{chapter}",
            "label": chapter,
            "type": "bab",
            "mastery": avg_mastery,
            "topics_count": len(members),
            "questions_in_bank": sum(topics[t]["questions_in_bank"] for t in members),
        })
        for t in members:
            edges.append({"source": t, "target": f"bab:{chapter}", "type": "contains"})

    # Edge depends_on: ko-okurensi topik dalam material yang sama
    dep_weights: Dict[tuple, int] = defaultdict(int)
    for ref, topic_set in material_groups.items():
        members = sorted(topic_set)
        for i in range(len(members)):
            for j in range(i + 1, len(members)):
                dep_weights[(members[i], members[j])] += 1
    for (a, b), weight in sorted(dep_weights.items()):
        edges.append({"source": a, "target": b, "type": "depends_on", "weight": weight})

    return {
        "subject_id": subject_id,
        "nodes": nodes,
        "edges": edges,
        "meta": {
            "topics_count": sum(1 for n in nodes if n["type"] == "topik"),
            "babs_count": sum(1 for n in nodes if n["type"] == "bab"),
            "dependencies_count": sum(1 for e in edges if e["type"] == "depends_on"),
            "weak_topics_count": sum(1 for n in nodes if n.get("status") == "lemah"),
            "data_ready": any(n.get("mastery") is not None for n in nodes),
        },
    }
