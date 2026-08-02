"""
Assessment Engine — pure Python, zero AI calls.

Responsibilities:
  - Score MCQ / True-False locally
  - Aggregate topic-level accuracy
  - Compute grade, performance level, overall stats
  - Generate rule-based study recommendations

AI is NOT called from this module.
"""
from __future__ import annotations

import json
import datetime
from typing import List, Dict, Optional, Tuple

from models import QuestionBank, Material


# ─── Grading helpers ─────────────────────────────────────────────────────────

from services.grading_utils import calculate_grade

def _performance(score: int) -> str:
    if score >= 90: return "Sangat Baik"
    if score >= 75: return "Baik"
    if score >= 60: return "Cukup"
    if score >= 40: return "Perlu Perbaikan"
    return "Kritis"

def _badge(score: int) -> str:
    if score >= 90: return "Excellent"
    if score >= 80: return "Very Good"
    if score >= 70: return "Good"
    return "Need Improvement"

def _normalize_answer(ans: str) -> str:
    """Strip, uppercase, take first non-space char for MCQ letter comparison."""
    ans = (ans or "").strip().upper()
    return ans[:1] if ans else ""


# ─── Core scorer ─────────────────────────────────────────────────────────────

def score_objective(
    questions: List[dict],
    answers: Dict[str, str],
) -> Tuple[int, int, int, List[dict]]:
    """
    Score MCQ and True/False questions locally.

    Args:
        questions : list of question dicts (must have 'id', 'type', 'answer')
        answers   : {str(question_id): user_answer_string}

    Returns:
        (correct, wrong, unanswered, per_question_feedback)
    """
    correct     = 0
    wrong       = 0
    unanswered  = 0
    feedback    = []

    for q in questions:
        qid      = str(q.get("id", ""))
        qtype    = q.get("type", "mcq")
        expected = q.get("answer", "").strip()
        user_ans = answers.get(qid, "").strip()

        if not user_ans:
            unanswered += 1
            feedback.append({
                "question_id":   int(qid) if qid.isdigit() else 0,
                "is_correct":    False,
                "user_answer":   "",
                "correct_answer": expected,
                "feedback":      "Tidak dijawab.",
            })
            continue

        if qtype in ("mcq", "truefalse"):
            # Letter-key comparison (A/B/C/D or Benar/Salah)
            is_correct = (
                _normalize_answer(user_ans) == _normalize_answer(expected)
                or user_ans.upper() == expected.upper()
            )
            if is_correct:
                correct += 1
            else:
                wrong += 1
            feedback.append({
                "question_id":    int(qid) if qid.isdigit() else 0,
                "is_correct":     is_correct,
                "user_answer":    user_ans,
                "correct_answer": expected,
                "feedback": (
                    "Jawaban benar." if is_correct
                    else f"Jawaban kurang tepat. Jawaban yang benar: {expected}"
                ),
            })
        else:
            # Subjective — mark as pending (will be handled by AI batch or skipped)
            feedback.append({
                "question_id":    int(qid) if qid.isdigit() else 0,
                "is_correct":     None,   # unknown until AI evaluation
                "user_answer":    user_ans,
                "correct_answer": expected,
                "feedback":       "Menunggu evaluasi.",
                "_pending_ai":    True,
            })

    return correct, wrong, unanswered, feedback


# ─── Topic analytics ─────────────────────────────────────────────────────────

def compute_topic_stats(
    questions: List[dict],
    per_q_feedback: List[dict],
) -> Tuple[List[dict], List[dict]]:
    """
    Aggregate per-question feedback into strong/weak topic lists.
    Returns (strong_topics, weak_topics).
    """
    topic_correct: Dict[str, int] = {}
    topic_wrong:   Dict[str, int] = {}
    topic_total:   Dict[str, int] = {}

    fb_map = {str(f["question_id"]): f for f in per_q_feedback}

    for q in questions:
        topic = q.get("topic") or "Umum"
        qid   = str(q.get("id", ""))
        fb    = fb_map.get(qid, {})
        is_correct = fb.get("is_correct")

        topic_total[topic] = topic_total.get(topic, 0) + 1
        if is_correct is True:
            topic_correct[topic] = topic_correct.get(topic, 0) + 1
        elif is_correct is False:
            topic_wrong[topic] = topic_wrong.get(topic, 0) + 1

    # Accuracy per topic
    all_topics = set(topic_correct) | set(topic_wrong)
    strong, weak = [], []

    for t in all_topics:
        total   = topic_total.get(t, 1)
        correct = topic_correct.get(t, 0)
        wrong   = topic_wrong.get(t, 0)
        acc     = round((correct / total) * 100) if total else 0

        if acc >= 70:
            mastery = "Mahir" if acc >= 90 else "Baik"
            strong.append({"topic": t, "correct_count": correct, "accuracy": acc, "mastery": mastery})
        else:
            priority = "Tinggi" if acc < 40 else "Menengah" if acc < 60 else "Rendah"
            weak.append({
                "topic": t, "wrong_count": wrong, "accuracy": acc,
                "issue": "Perlu lebih banyak latihan", "priority": priority,
            })

    strong.sort(key=lambda x: -x["accuracy"])
    weak.sort(key=lambda x: x["accuracy"])   # worst first
    return strong[:8], weak[:8]


# ─── Full evaluation assembler ────────────────────────────────────────────────

def assemble_evaluation(
    questions: List[dict],
    answers: Dict[str, str],
    subject_name: str = "Mata Kuliah",
    exam_type: str = "simulasi",
    ai_subjective_results: Optional[Dict[str, dict]] = None,
) -> dict:
    """
    Build the complete evaluation dict from Python-scored objective questions
    and optional AI-scored subjective feedback.

    This is the single source of truth for all scoring — AI never computes
    totals, grades, or percentages.
    """
    ai_subjective_results = ai_subjective_results or {}

    # 1. Score objective questions
    correct, wrong, unanswered, per_q_fb = score_objective(questions, answers)

    # 2. Merge AI subjective results
    for fb in per_q_fb:
        if fb.get("_pending_ai"):
            qid_str = str(fb["question_id"])
            ai_fb   = ai_subjective_results.get(qid_str, {})
            if ai_fb:
                fb["is_correct"] = ai_fb.get("is_correct", False)
                fb["feedback"]   = ai_fb.get("feedback", "Evaluasi tidak tersedia.")
                if ai_fb.get("is_correct"):
                    correct += 1
                else:
                    wrong += 1
            else:
                fb["is_correct"] = False
                fb["feedback"]   = "Evaluasi tidak tersedia (AI tidak merespons)."
                wrong += 1
            fb.pop("_pending_ai", None)

    total_q = len(questions)
    score   = round((correct / total_q) * 100) if total_q else 0

    # 3. Topic analytics
    strong_topics, weak_topics = compute_topic_stats(questions, per_q_fb)

    return {
        "score":                score,
        "total_correct":        correct,
        "total_wrong":          wrong,
        "total_unanswered":     unanswered,
        "grade":                calculate_grade(score),
        "badge":                _badge(score),
        "estimated_exam_score": min(100, round(score * 0.9 + 5)),
        "performance_level":    _performance(score),
        "strong_topics":        strong_topics,
        "weak_topics":          weak_topics,
        "per_question_feedback": [
            {k: v for k, v in fb.items() if k != "_pending_ai"}
            for fb in per_q_fb
        ],
        "overall_feedback": (
            f"Kamu menjawab {correct} dari {total_q} soal dengan benar ({score}%). "
            + ("Pertahankan!" if score >= 80 else "Terus berlatih untuk meningkatkan nilai.")
        ),
    }


# ─── Rule-based study recommendation ─────────────────────────────────────────

# Score-tier constants: (min_acc_inclusive, max_acc_exclusive) → (days, duration_min, activity_type)
_TIER_RULES: List[Tuple[int, int, int, int, str]] = [
    # (lo, hi, days, duration_min, activity_type)
    (0,  40,  4, 60, "review"),    # URGENT
    (40, 60,  2, 45, "practice"),  # HIGH
    (60, 80,  1, 30, "review"),    # MEDIUM
    (80, 101, 0,  0, ""),          # LOW → skip
]

def _classify_tier(acc: int) -> Tuple[int, int, str]:
    """Return (days, duration_minutes, activity_type) for the given accuracy."""
    for lo, hi, days, dur, atype in _TIER_RULES:
        if lo <= acc < hi:
            return days, dur, atype
    # Fallback: treat any out-of-range as URGENT
    return 4, 60, "review"

TIME_SLOTS = [
    "Pagi (08:00–09:00)",
    "Sore (15:00–16:00)",
    "Malam (19:00–20:00)",
]

_URGENT_ACTIVITIES = [
    "Pelajari konsep dasar {topic} — fokus pemahaman definisi dan rumus inti",
    "Latihan soal dasar {topic} — kerjakan soal pemula untuk memperkuat fondasi",
    "Review mendalam {topic} — identifikasi kesalahan umum dan perbaiki pemahaman",
    "Simulasi mini {topic} — uji pemahaman dengan soal campuran sebelum ujian",
]

_HIGH_ACTIVITIES = [
    "Latihan soal {topic} — drill soal menengah dan review kesalahan",
    "Review kesalahan {topic} — perbaiki pola salah jawab dan perkuat konsep",
]

_MEDIUM_ACTIVITIES = [
    "Review singkat {topic} — pastikan konsep sudah dipahami dan siap ujian",
]

_LOW_ACTIVITIES = []  # skipped

_TIER_ACTIVITY_MAP = {
    "urgent": _URGENT_ACTIVITIES,
    "high": _HIGH_ACTIVITIES,
    "medium": _MEDIUM_ACTIVITIES,
    "low": _LOW_ACTIVITIES,
}

def _acc_to_tier_key(acc: int) -> str:
    if acc < 40:
        return "urgent"
    elif acc < 60:
        return "high"
    elif acc < 80:
        return "medium"
    return "low"

def _tier_activity_description(topic: str, activity_type: str, acc: int, day_index: int = 0) -> str:
    """Generate activity description text, varies by day_index within the tier."""
    tier_key = _acc_to_tier_key(acc)
    activities = _TIER_ACTIVITY_MAP.get(tier_key, _URGENT_ACTIVITIES)
    if not activities:
        return f"Topik {topic} sudah dikuasai — tidak perlu latihan tambahan"
    template = activities[day_index % len(activities)]
    return template.format(topic=topic)


_FALLBACK_ACTIVITIES = {
    "review": "Review topik {topic} — perkuat pemahaman konsep",
    "practice": "Latihan soal topik {topic} — drill dan perbaiki kesalahan",
    "simulation": "Simulasi ujian penuh — uji seluruh kemampuan yang sudah dipelajari",
    "rest": "Istirahat dan recovery — persiapan untuk sesi berikutnya",
}

def fallback_activity_description(topic: str, activity_type: str) -> str:
    """Generate a fallback activity description for old plans missing activity text."""
    template = _FALLBACK_ACTIVITIES.get(activity_type, "Review topik {topic}")
    return template.format(topic=topic)


def _get_resources(db, subject_id, topic: str, subject_name: str) -> str:
    """Return a resources string for a study plan item."""
    if db is None or subject_id is None:
        return f"Materi {subject_name} — topik {topic}"
    try:
        count = db.query(QuestionBank).filter(
            QuestionBank.subject_id == subject_id,
            QuestionBank.topic == topic
        ).count()
        if count > 0:
            return f"{count} soal latihan tersedia — topik {topic}"
        mat_count = db.query(Material).filter(
            Material.subject_id == subject_id
        ).count()
        if mat_count > 0:
            return f"Baca materi {subject_name} — topik {topic}"
        return "Gunakan Notebook dan Flashcard untuk review mandiri"
    except Exception:
        return f"Materi {subject_name} — topik {topic}"


def generate_study_plan(
    weak_topics: List[dict],
    strong_topics: List[dict],
    score: int,
    subject_name: str = "Mata Kuliah",
    total_days: int = 7,
    db=None,
    subject_id: int = None,
) -> dict:
    """
    Rule-based 7-day study plan. No AI required.

    Score-tier rules (by topic accuracy):
      accuracy < 40  → URGENT: 4 days at 60 min each, activity_type="review"
      accuracy 40–59 → HIGH: 2 days at 45 min each, activity_type="practice"
      accuracy 60–79 → MEDIUM: 1 day at 30 min, activity_type="review"
      accuracy >= 80 → LOW: skip entirely

    Always returns exactly 7 items in study_plan.
    Slots 1–6 filled with weak topics (tier-based) + "Review Umum" gap-fill.
    Slot 7 always = "Simulasi Penuh" (simulation).

    Motivational message is selected from a fixed table based on score.
    """
    # ── Motivational messages by score band ──────────────────────────────────
    if score >= 90:
        msg = f"Luar biasa! Nilai kamu {score}. Pertahankan dan siapkan diri untuk ujian asli."
    elif score >= 75:
        msg = f"Bagus! Nilai kamu {score}. Fokus pada topik lemah dan kamu akan siap ujian."
    elif score >= 60:
        msg = f"Cukup baik. Nilai kamu {score}. Masih ada ruang untuk meningkat — terus berlatih."
    else:
        msg = f"Nilai kamu {score}. Jangan menyerah! Mulai dari topik yang paling dasar dulu."

    # ── Priority actions ─────────────────────────────────────────────────────
    priority_actions = []
    for wt in weak_topics[:3]:
        priority_actions.append(
            f"Review topik '{wt['topic']}' (akurasi {wt.get('accuracy', '?')}% — prioritas {wt.get('priority', 'Menengah')})"
        )
    if score < 60:
        priority_actions.append("Baca ulang seluruh materi sebelum latihan soal.")
    if strong_topics:
        priority_actions.append(
            f"Topik '{strong_topics[0]['topic']}' sudah dikuasai — fokus ke topik lemah."
        )

    # ── Build day slots (cap = 6; slot 7 reserved for Simulasi Penuh) ────────
    # Sort weak_topics worst-first (lowest accuracy first); default accuracy=0 if missing
    sorted_weak = sorted(weak_topics, key=lambda t: t.get("accuracy", 0))

    day_slots: List[dict] = []

    day_counter = 0  # global counter for day_index across all topics
    for wt in sorted_weak:
        if len(day_slots) >= 6:
            break
        acc = wt.get("accuracy", 0)  # default to 0 (URGENT) if missing
        days, dur, atype = _classify_tier(acc)

        if days == 0:
            # LOW tier → skip entirely
            continue

        topic = wt.get("topic", "Topik")

        for day_in_topic in range(days):
            if len(day_slots) >= 6:
                break
            activity_desc = _tier_activity_description(topic, atype, acc, day_in_topic)
            day_slots.append({
                "topic": topic,
                "activity": activity_desc,
                "type": atype,
                "duration_minutes": dur,
                "time_slot": TIME_SLOTS[day_counter % len(TIME_SLOTS)],
                "resources": _get_resources(db, subject_id, topic, subject_name),
            })
            day_counter += 1

    # ── Fill remaining slots (up to 6) with Review Umum ──────────────────────
    while len(day_slots) < 6:
        day_slots.append({
            "topic": "Review Umum",
            "activity": "Review umum seluruh materi — perkuat pemahaman topik yang sudah dipelajari",
            "type": "review",
            "duration_minutes": 60,
            "time_slot": TIME_SLOTS[day_counter % len(TIME_SLOTS)],
            "resources": "",
        })
        day_counter += 1

    # ── Always append Simulasi Penuh as 7th item ─────────────────────────────
    day_slots.append({
        "topic": "Simulasi Penuh",
        "activity": "Simulasi ujian penuh — uji seluruh kemampuan yang sudah dipelajari",
        "type": "simulation",
        "duration_minutes": 60,
        "time_slot": TIME_SLOTS[day_counter % len(TIME_SLOTS)],
        "resources": "",
    })

    # ── Label each slot ───────────────────────────────────────────────────────
    plan_items = []
    for i, slot in enumerate(day_slots):
        plan_items.append({
            "label": f"Hari {i + 1}",
            "order_number": i,
            "topic": slot["topic"],
            "activity": slot["activity"],
            "type": slot["type"],
            "duration_minutes": slot["duration_minutes"],
            "time_slot": slot.get("time_slot", ""),
            "resources": slot["resources"],
        })

    return {
        "motivational_message": msg,
        "priority_actions": priority_actions[:4],
        "study_plan": plan_items,
    }



