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


# ─── Grading helpers ─────────────────────────────────────────────────────────

def _grade(score: int) -> str:
    if score >= 90: return "A"
    if score >= 80: return "B"
    if score >= 70: return "C"
    if score >= 60: return "D"
    return "E"

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
        "grade":                _grade(score),
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

_ACTIVITY_BY_ACCURACY = {
    # (min_acc, max_acc): activity_type
    (0,  40):  "intensive_review",
    (40, 60):  "review",
    (60, 80):  "practice",
    (80, 101): "simulation",
}

def _activity_type(acc: int) -> str:
    for (lo, hi), atype in _ACTIVITY_BY_ACCURACY.items():
        if lo <= acc < hi:
            return atype
    return "review"

def _duration_by_priority(priority: str) -> int:
    return {"Tinggi": 60, "Menengah": 45, "Rendah": 30}.get(priority, 45)


def generate_study_plan(
    weak_topics: List[dict],
    strong_topics: List[dict],
    score: int,
    subject_name: str = "Mata Kuliah",
    total_days: int = 7,
) -> dict:
    """
    Rule-based 7-day study plan. No AI required.

    Priority rules:
      accuracy < 40  → intensive_review, 60 min
      40–60          → review, 45 min
      60–80          → practice, 30 min
      80+            → simulation / rest

    Motivational message is selected from a fixed table based on score.
    """
    # Motivational messages by score band
    if score >= 90:
        msg = f"Luar biasa! Nilai kamu {score}. Pertahankan dan siapkan diri untuk ujian asli."
    elif score >= 75:
        msg = f"Bagus! Nilai kamu {score}. Fokus pada topik lemah dan kamu akan siap ujian."
    elif score >= 60:
        msg = f"Cukup baik. Nilai kamu {score}. Masih ada ruang untuk meningkat — terus berlatih."
    else:
        msg = f"Nilai kamu {score}. Jangan menyerah! Mulai dari topik yang paling dasar dulu."

    # Priority actions
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

    # Build daily plan
    plan_items = []
    weak_queue  = list(weak_topics)  # topics needing most attention first
    strong_queue= list(strong_topics)

    for day in range(1, total_days + 1):
        if day == total_days:
            # Last day = full simulation
            item = {
                "day": day,
                "label": f"Hari {day}",
                "topic": "Simulasi Penuh",
                "activity": f"Kerjakan simulasi ujian {subject_name} lengkap untuk mengukur kesiapan.",
                "type": "simulation",
                "duration_minutes": 60,
                "resources": f"Gunakan fitur Exam Analyzer untuk simulasi {subject_name}.",
            }
        elif weak_queue:
            wt   = weak_queue.pop(0)
            acc  = wt.get("accuracy", 50)
            atype = _activity_type(acc)
            dur   = _duration_by_priority(wt.get("priority", "Menengah"))
            desc  = (
                f"Review mendalam topik '{wt['topic']}' (akurasi saat ini: {acc}%)."
                if atype == "intensive_review"
                else f"Pelajari kembali topik '{wt['topic']}' dan kerjakan latihan soal."
            )
            item = {
                "day": day,
                "label": f"Hari {day}",
                "topic": wt["topic"],
                "activity": desc,
                "type": atype,
                "duration_minutes": dur,
                "resources": f"Materi {subject_name} — topik {wt['topic']}.",
            }
        elif strong_queue:
            st   = strong_queue.pop(0)
            item = {
                "day": day,
                "label": f"Hari {day}",
                "topic": st["topic"],
                "activity": f"Latihan soal tingkat lanjut untuk topik '{st['topic']}'.",
                "type": "practice",
                "duration_minutes": 30,
                "resources": f"Soal-soal latihan {subject_name}.",
            }
        else:
            # Extra day: rest or mixed review
            item = {
                "day": day,
                "label": f"Hari {day}",
                "topic": "Review Umum",
                "activity": "Ulas kembali seluruh catatan dan flashcard.",
                "type": "review",
                "duration_minutes": 30,
                "resources": "Notebook dan Flashcard di Kabayan AI.",
            }
        plan_items.append(item)

    return {
        "motivational_message": msg,
        "priority_actions": priority_actions[:4],
        "study_plan": plan_items,
    }



