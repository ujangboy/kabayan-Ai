"""
Question Bank Repository
Handles persistent storage and retrieval of AI-generated questions.
"""
import datetime
from time_utils import utcnow
import json
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from models import QuestionBank
from repositories.base import BaseRepository


class QuestionBankRepository(BaseRepository[QuestionBank]):
    def __init__(self):
        super().__init__(QuestionBank)

    # ── Query ────────────────────────────────────────────────────────────────

    def count_by_topic(
        self,
        db: Session,
        subject_id: int,
        topic: str,
        difficulty: str,
        question_type: Optional[str] = None,
    ) -> int:
        q = (
            db.query(func.count(QuestionBank.id))
            .filter(
                QuestionBank.subject_id == subject_id,
                QuestionBank.topic == topic,
                QuestionBank.difficulty == difficulty,
            )
        )
        if question_type and question_type != "mixed":
            q = q.filter(QuestionBank.question_type == question_type)
        return q.scalar() or 0

    def get_by_topic(
        self,
        db: Session,
        subject_id: int,
        topic: str,
        difficulty: Optional[str] = None,
        question_type: Optional[str] = None,
        limit: int = 50,
    ) -> List[QuestionBank]:
        q = (
            db.query(QuestionBank)
            .filter(
                QuestionBank.subject_id == subject_id,
                QuestionBank.topic.ilike(topic),  # case-insensitive match
            )
        )
        if difficulty and difficulty != "campuran":
            q = q.filter(QuestionBank.difficulty == difficulty)
        if question_type and question_type != "mixed":
            q = q.filter(QuestionBank.question_type == question_type)
        rows = q.limit(limit).all()
        # Fallback: partial match jika exact ilike tidak menemukan hasil
        if not rows:
            q2 = (
                db.query(QuestionBank)
                .filter(
                    QuestionBank.subject_id == subject_id,
                    QuestionBank.topic.ilike(f"%{topic}%"),
                )
            )
            if difficulty and difficulty != "campuran":
                q2 = q2.filter(QuestionBank.difficulty == difficulty)
            if question_type and question_type != "mixed":
                q2 = q2.filter(QuestionBank.question_type == question_type)
            rows = q2.limit(limit).all()
        return rows

    def get_by_subject(
        self,
        db: Session,
        subject_id: int,
        difficulty: Optional[str] = None,
        question_type: Optional[str] = None,
        limit: int = 200,
    ) -> List[QuestionBank]:
        q = db.query(QuestionBank).filter(QuestionBank.subject_id == subject_id)
        if difficulty and difficulty != "campuran":
            q = q.filter(QuestionBank.difficulty == difficulty)
        if question_type and question_type != "mixed":
            q = q.filter(QuestionBank.question_type == question_type)
        return q.limit(limit).all()

    # ── Write ────────────────────────────────────────────────────────────────

    def bulk_insert(
        self,
        db: Session,
        subject_id: int,
        blueprint_id: Optional[int],
        questions: List[dict],
    ) -> int:
        """
        Persist a list of AI-generated question dicts to the bank.
        Returns the count of rows inserted.
        """
        count = 0
        for q in questions:
            choices = q.get("options") or {}
            if isinstance(choices, dict):
                choices_json = json.dumps(choices, ensure_ascii=False)
            else:
                choices_json = None

            row = QuestionBank(
                subject_id     = subject_id,
                blueprint_id   = blueprint_id,
                chapter        = q.get("chapter"),
                topic          = q.get("topic", "Umum"),
                difficulty     = q.get("difficulty", "menengah"),
                bloom_level    = q.get("bloom_level"),
                question_type  = q.get("type", "mcq"),
                question       = q.get("question", ""),
                choices_json   = choices_json,
                correct_answer = q.get("answer", ""),
                explanation    = q.get("explanation"),
                material_ref   = q.get("material_reference"),
                tips           = q.get("tips"),
                created_by_ai  = 1,
                used_count     = 0,
                created_at     = utcnow(),
            )
            db.add(row)
            count += 1
        db.flush()
        return count

    def increment_used(self, db: Session, question_ids: List[int]) -> None:
        """Bump used_count for drawn questions (analytics only, non-critical)."""
        if not question_ids:
            return
        try:
            db.query(QuestionBank).filter(
                QuestionBank.id.in_(question_ids)
            ).update({QuestionBank.used_count: QuestionBank.used_count + 1},
                     synchronize_session=False)
            db.flush()
        except Exception:
            db.rollback()

    def update_explanation(
        self, db: Session, question_id: int, explanation: str
    ) -> Optional[QuestionBank]:
        """Save lazy-loaded AI explanation back to the bank for reuse."""
        q = self.get(db, question_id)
        if q:
            q.explanation = explanation
            db.flush()
            db.refresh(q)
        return q

    def stats_by_subject(self, db: Session, subject_id: int) -> dict:
        """Return question counts grouped by topic and difficulty."""
        rows = self.get_by_subject(db, subject_id, limit=5000)
        stats: dict = {}
        for r in rows:
            key = r.topic
            if key not in stats:
                stats[key] = {"total": 0, "mudah": 0, "menengah": 0, "sulit": 0}
            stats[key]["total"] += 1
            diff = r.difficulty or "menengah"
            if diff in stats[key]:
                stats[key][diff] += 1
        return stats


question_bank_repository = QuestionBankRepository()
