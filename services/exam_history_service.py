"""
Exam History Service
Handles: saving exam results persistently, managing attempts,
         study plan progress, retry logic, and status lifecycle.
"""
import json
import logging
import datetime
from typing import Optional
from sqlalchemy.orm import Session

from repositories.exam_history_repository import (
    exam_history_session_repo,
    exam_attempt_repo,
    exam_review_repo,
    study_plan_repo,
    study_plan_item_repo,
)
from models import ExamHistorySession, StudyPlan, StudyPlanItem

logger = logging.getLogger(__name__)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _calc_grade(score: int) -> str:
    if score >= 90: return "A"
    if score >= 80: return "B"
    if score >= 70: return "C"
    if score >= 60: return "D"
    return "E"

def _calc_status(score: int, current_status: str) -> str:
    if score >= 90:
        return "mastered"
    if current_status in ("mastered",):
        return "mastered"  # never downgrade mastered
    return "completed"

def _calc_progress(attempts: list) -> int:
    """Progress = improvement from first attempt to latest, capped at 100."""
    if not attempts:
        return 0
    scores = [a.score for a in attempts if a.score is not None]
    if not scores:
        return 0
    if len(scores) == 1:
        return min(scores[0], 100)
    first, latest = scores[0], scores[-1]
    if latest >= 90:
        return 100
    improvement = max(0, latest - first)
    # Map improvement on a 0-100 scale (40-point swing = 100%)
    return min(100, int((improvement / 40) * 100) + int(first * 0.5))

def _serialize_study_plan(plan_data: dict) -> dict:
    """Normalise AI recommendation output into storable format."""
    return {
        "title": plan_data.get("title", "Rencana Belajar"),
        "motivational_message": plan_data.get("motivational_message", ""),
        "priority_actions": plan_data.get("priority_actions", []),
        "study_plan": plan_data.get("study_plan", []),
    }


# ─── Main Service ─────────────────────────────────────────────────────────────

class ExamHistoryService:

    # ── 1. Save completed exam (called when user clicks "Selesai") ────────────
    @staticmethod
    def save_session(
        db: Session,
        subject_id: int,
        subject_name: str,
        title: str,
        exam_type: str,
        difficulty: str,
        bloom_level: str,
        question_type: str,
        total_questions: int,
        score: int,
        total_correct: int,
        total_wrong: int,
        evaluation_json_str: str,        # full AI evaluation JSON string
        questions_json_str: str,         # all questions JSON string
        answers_json_str: str,           # user answers JSON string
        study_plan_data: Optional[dict] = None,
        duration_seconds: Optional[int] = None,
    ) -> dict:
        try:
            eval_data  = json.loads(evaluation_json_str) if evaluation_json_str else {}
        except json.JSONDecodeError:
            raise ValueError("Format data ujian tidak valid: evaluation_json bukan JSON valid")
        grade      = eval_data.get("grade") or _calc_grade(score)
        status     = "mastered" if score >= 90 else "completed"
        weak_json  = json.dumps(eval_data.get("weak_topics", []),   ensure_ascii=False)
        strong_json= json.dumps(eval_data.get("strong_topics", []), ensure_ascii=False)

        # Create history session row
        hs = ExamHistorySession(
            subject_id=subject_id,
            subject_name=subject_name,
            title=title,
            exam_type=exam_type,
            difficulty=difficulty,
            bloom_level=bloom_level,
            question_type=question_type,
            total_questions=total_questions,
            best_score=score,
            latest_score=score,
            grade=grade,
            progress=score,   # first attempt progress = score itself
            status=status,
            weak_topics_json=weak_json,
            strong_topics_json=strong_json,
            evaluation_json=evaluation_json_str,
            questions_json=questions_json_str,
            answers_json=answers_json_str,
            created_at=datetime.datetime.utcnow(),
            updated_at=datetime.datetime.utcnow(),
        )
        db.add(hs)
        db.commit()
        db.refresh(hs)

        # Create first attempt
        attempt = exam_attempt_repo.create_attempt(
            db=db,
            history_session_id=hs.id,
            score=score,
            grade=grade,
            total_correct=total_correct,
            total_wrong=total_wrong,
            questions_json=questions_json_str,
            answers_json=answers_json_str,
            evaluation_json=evaluation_json_str,
            duration_seconds=duration_seconds,
        )

        # Persist per-question reviews
        ExamHistoryService._save_reviews(db, attempt.id, questions_json_str, answers_json_str, eval_data)

        # Persist study plan if provided
        if study_plan_data:
            ExamHistoryService._save_study_plan(db, hs.id, study_plan_data)

        return {"history_session_id": hs.id, "attempt_id": attempt.id, "status": status}

    # ── 2. Retry — create a new attempt on existing history session ───────────
    @staticmethod
    def save_retry_attempt(
        db: Session,
        history_session_id: int,
        score: int,
        total_correct: int,
        total_wrong: int,
        evaluation_json_str: str,
        questions_json_str: str,
        answers_json_str: str,
        duration_seconds: Optional[int] = None,
    ) -> dict:
        hs = exam_history_session_repo.get(db, history_session_id)
        if not hs:
            raise ValueError("History session tidak ditemukan.")

        try:
            eval_data = json.loads(evaluation_json_str) if evaluation_json_str else {}
        except json.JSONDecodeError:
            raise ValueError("Format data ujian tidak valid: evaluation_json bukan JSON valid")
        grade     = eval_data.get("grade") or _calc_grade(score)

        attempt = exam_attempt_repo.create_attempt(
            db=db,
            history_session_id=history_session_id,
            score=score,
            grade=grade,
            total_correct=total_correct,
            total_wrong=total_wrong,
            questions_json=questions_json_str,
            answers_json=answers_json_str,
            evaluation_json=evaluation_json_str,
            duration_seconds=duration_seconds,
        )

        # Persist reviews for this attempt
        ExamHistoryService._save_reviews(db, attempt.id, questions_json_str, answers_json_str, eval_data)

        # Recalculate progress & status
        all_attempts = exam_attempt_repo.get_by_session(db, history_session_id)
        progress = _calc_progress(all_attempts)
        status   = _calc_status(score, hs.status)

        exam_history_session_repo.update_after_attempt(
            db, history_session_id, score, grade, progress, status
        )
        # Update weak/strong topics from latest evaluation
        hs.weak_topics_json   = json.dumps(eval_data.get("weak_topics", []),   ensure_ascii=False)
        hs.strong_topics_json = json.dumps(eval_data.get("strong_topics", []), ensure_ascii=False)
        hs.evaluation_json    = evaluation_json_str
        hs.questions_json     = questions_json_str
        hs.answers_json       = answers_json_str
        db.commit()

        return {"history_session_id": history_session_id, "attempt_id": attempt.id,
                "attempt_number": attempt.attempt_number, "status": status, "progress": progress}

    # ── 3. Get full history list ───────────────────────────────────────────────
    @staticmethod
    def get_history_list(db: Session, subject_id: Optional[int] = None) -> list:
        if subject_id:
            sessions = exam_history_session_repo.get_by_subject(db, subject_id)
        else:
            sessions = exam_history_session_repo.get_all_ordered(db)

        result = []
        for s in sessions:
            attempts = exam_attempt_repo.get_by_session(db, s.id)
            attempt_list = [
                {
                    "id": a.id,
                    "attempt_number": a.attempt_number,
                    "score": a.score,
                    "grade": a.grade,
                    "total_correct": a.total_correct,
                    "total_wrong": a.total_wrong,
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                }
                for a in attempts
            ]
            plan = study_plan_repo.get_by_history_session(db, s.id)
            result.append({
                "id": s.id,
                "subject_id": s.subject_id,
                "subject_name": s.subject_name,
                "title": s.title,
                "exam_type": s.exam_type,
                "difficulty": s.difficulty,
                "total_questions": s.total_questions,
                "best_score": s.best_score,
                "latest_score": s.latest_score,
                "grade": s.grade,
                "progress": s.progress,
                "status": s.status,
                "weak_topics": json.loads(s.weak_topics_json) if s.weak_topics_json else [],
                "strong_topics": json.loads(s.strong_topics_json) if s.strong_topics_json else [],
                "attempt_count": len(attempts),
                "attempts": attempt_list,
                "has_study_plan": plan is not None,
                "study_plan_progress": plan.progress if plan else 0,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            })
        return result

    # ── 4. Get session detail ──────────────────────────────────────────────────
    @staticmethod
    def get_session_detail(db: Session, history_session_id: int) -> dict:
        s = exam_history_session_repo.get(db, history_session_id)
        if not s:
            raise ValueError("History session tidak ditemukan.")

        attempts = exam_attempt_repo.get_by_session(db, s.id)
        attempt_data = []
        for a in attempts:
            reviews = exam_review_repo.get_by_attempt(db, a.id)
            attempt_data.append({
                "id": a.id,
                "attempt_number": a.attempt_number,
                "score": a.score,
                "grade": a.grade,
                "total_correct": a.total_correct,
                "total_wrong": a.total_wrong,
                "duration_seconds": a.duration_seconds,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "reviews": [
                    {
                        "id": r.id,
                        "question_number": r.question_number,
                        "topic": r.topic,
                        "question_text": r.question_text,
                        "question_type": r.question_type,
                        "bloom_level": r.bloom_level,
                        "difficulty": r.difficulty,
                        "user_answer": r.user_answer,
                        "correct_answer": r.correct_answer,
                        "is_correct": bool(r.is_correct),
                        "ai_explanation": r.ai_explanation,
                        "material_ref": r.material_ref,
                        "tips": r.tips,
                        "item_score": r.item_score,
                    }
                    for r in reviews
                ],
            })

        plan = study_plan_repo.get_by_history_session(db, s.id)
        plan_data = None
        if plan:
            items = study_plan_item_repo.get_by_plan(db, plan.id)
            plan_data = {
                "id": plan.id,
                "title": plan.title,
                "motivational_message": plan.motivational_message,
                "priority_actions": json.loads(plan.priority_actions_json) if plan.priority_actions_json else [],
                "total_days": plan.total_days,
                "completed_days": plan.completed_days,
                "progress": plan.progress,
                "items": [
                    {
                        "id": i.id,
                        "order_number": i.order_number,
                        "day_label": i.day_label,
                        "topic": i.topic,
                        "activity": i.activity,
                        "activity_type": i.activity_type,
                        "duration_minutes": i.duration_minutes,
                        "resources": i.resources,
                        "completed": bool(i.completed),
                    }
                    for i in items
                ],
            }

        eval_data = json.loads(s.evaluation_json) if s.evaluation_json else {}

        return {
            "id": s.id,
            "subject_id": s.subject_id,
            "subject_name": s.subject_name,
            "title": s.title,
            "exam_type": s.exam_type,
            "difficulty": s.difficulty,
            "bloom_level": s.bloom_level,
            "question_type": s.question_type,
            "total_questions": s.total_questions,
            "best_score": s.best_score,
            "latest_score": s.latest_score,
            "grade": s.grade,
            "progress": s.progress,
            "status": s.status,
            "weak_topics": json.loads(s.weak_topics_json) if s.weak_topics_json else [],
            "strong_topics": json.loads(s.strong_topics_json) if s.strong_topics_json else [],
            "overall_feedback": eval_data.get("overall_feedback", ""),
            "performance_level": eval_data.get("performance_level", ""),
            "attempts": attempt_data,
            "study_plan": plan_data,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }

    # ── 5. Toggle study plan item ──────────────────────────────────────────────
    @staticmethod
    def toggle_plan_item(db: Session, item_id: int) -> dict:
        item = study_plan_item_repo.toggle_completed(db, item_id)
        if not item:
            raise ValueError("Item tidak ditemukan.")
        plan = study_plan_repo.get(db, item.plan_id)
        return {
            "item_id": item.id,
            "completed": bool(item.completed),
            "plan_progress": plan.progress if plan else 0,
            "plan_completed_days": plan.completed_days if plan else 0,
        }

    # ── 6. Save study plan to existing history session ────────────────────────
    @staticmethod
    def save_study_plan(db: Session, history_session_id: int, plan_data: dict) -> dict:
        ExamHistoryService._save_study_plan(db, history_session_id, plan_data)
        return {"status": "saved"}

    # ── 7. Delete history session ──────────────────────────────────────────────
    @staticmethod
    def delete_session(db: Session, history_session_id: int) -> bool:
        return exam_history_session_repo.delete(db, history_session_id)

    # ── Private helpers ────────────────────────────────────────────────────────
    @staticmethod
    def _save_reviews(
        db: Session,
        attempt_id: int,
        questions_json_str: str,
        answers_json_str: str,
        eval_data: dict,
    ) -> None:
        try:
            questions_data = json.loads(questions_json_str) if questions_json_str else {}
            questions = questions_data.get("questions", [])
            answers   = json.loads(answers_json_str) if answers_json_str else {}
            per_q_fb  = {str(f["question_id"]): f for f in eval_data.get("per_question_feedback", [])}

            rows = []
            for q in questions:
                qid      = str(q.get("id", ""))
                fb       = per_q_fb.get(qid, {})
                user_ans = answers.get(qid, "")
                rows.append({
                    "attempt_id":      attempt_id,
                    "question_number": q.get("id", 0),
                    "topic":           q.get("topic", ""),
                    "question_text":   q.get("question", ""),
                    "question_type":   q.get("type", ""),
                    "bloom_level":     q.get("bloom_level", ""),
                    "difficulty":      q.get("difficulty", ""),
                    "user_answer":     user_ans,
                    "correct_answer":  fb.get("correct_answer") or q.get("answer", ""),
                    "is_correct":      1 if fb.get("is_correct") else 0,
                    "ai_explanation":  fb.get("feedback") or q.get("explanation", ""),
                    "material_ref":    q.get("material_reference", ""),
                    "tips":            q.get("tips", ""),
                    "item_score":      100 if fb.get("is_correct") else 0,
                })
            exam_review_repo.bulk_create(db, rows)
        except Exception as exc:
            logger.warning(f"_save_reviews failed (non-fatal): {exc}")

    @staticmethod
    def _save_study_plan(db: Session, history_session_id: int, plan_data: dict) -> None:
        try:
            # Delete existing plan for this session — same transaction, no commit yet
            existing = study_plan_repo.get_by_history_session(db, history_session_id)
            if existing:
                db.delete(existing)

            sp_items = plan_data.get("study_plan", [])
            plan = StudyPlan(
                history_session_id=history_session_id,
                title=plan_data.get("title", "Rencana Belajar"),
                motivational_message=plan_data.get("motivational_message", ""),
                priority_actions_json=json.dumps(plan_data.get("priority_actions", []), ensure_ascii=False),
                total_days=len(sp_items),
                completed_days=0,
                progress=0,
                created_at=datetime.datetime.utcnow(),
                updated_at=datetime.datetime.utcnow(),
            )
            db.add(plan)
            db.flush()
            db.refresh(plan)

            for idx, day in enumerate(sp_items):
                db.add(StudyPlanItem(
                    plan_id=plan.id,
                    order_number=idx,
                    day_label=day.get("label", f"Hari {idx+1}"),
                    topic=day.get("topic", ""),
                    activity=day.get("activity", ""),
                    activity_type=day.get("type", "review"),
                    duration_minutes=day.get("duration_minutes"),
                    resources=day.get("resources", ""),
                    completed=0,
                ))
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error(f"Gagal simpan study plan: {exc}")
            raise


exam_history_service = ExamHistoryService()
