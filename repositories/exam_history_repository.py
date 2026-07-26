from sqlalchemy.orm import Session
from sqlalchemy import desc
from models import (
    ExamHistorySession, ExamAttempt, ExamReview,
    StudyPlan, StudyPlanItem
)
from repositories.base import BaseRepository
from typing import List, Optional
import datetime


class ExamHistorySessionRepository(BaseRepository[ExamHistorySession]):
    def __init__(self):
        super().__init__(ExamHistorySession)

    def get_all_ordered(self, db: Session, limit: int = 200) -> List[ExamHistorySession]:
        return (
            db.query(self.model)
            .order_by(desc(self.model.created_at))
            .limit(limit)
            .all()
        )

    def get_by_subject(self, db: Session, subject_id: int) -> List[ExamHistorySession]:
        return (
            db.query(self.model)
            .filter(self.model.subject_id == subject_id)
            .order_by(desc(self.model.created_at))
            .all()
        )

    def search(self, db: Session, query: str) -> List[ExamHistorySession]:
        q = f"%{query}%"
        return (
            db.query(self.model)
            .filter(
                self.model.title.ilike(q)
                | self.model.subject_name.ilike(q)
                | self.model.exam_type.ilike(q)
            )
            .order_by(desc(self.model.created_at))
            .all()
        )

    def update_after_attempt(
        self,
        db: Session,
        session_id: int,
        latest_score: int,
        grade: str,
        progress: int,
        status: str,
    ) -> Optional[ExamHistorySession]:
        obj = self.get(db, session_id)
        if not obj:
            return None
        obj.latest_score = latest_score
        obj.grade = grade
        obj.progress = progress
        obj.status = status
        obj.updated_at = datetime.datetime.utcnow()
        if obj.best_score is None or latest_score > obj.best_score:
            obj.best_score = latest_score
        db.commit()
        db.refresh(obj)
        return obj


class ExamAttemptRepository(BaseRepository[ExamAttempt]):
    def __init__(self):
        super().__init__(ExamAttempt)

    def get_by_session(self, db: Session, history_session_id: int) -> List[ExamAttempt]:
        return (
            db.query(self.model)
            .filter(self.model.history_session_id == history_session_id)
            .order_by(self.model.attempt_number)
            .all()
        )

    def next_attempt_number(self, db: Session, history_session_id: int) -> int:
        last = (
            db.query(self.model)
            .filter(self.model.history_session_id == history_session_id)
            .order_by(desc(self.model.attempt_number))
            .first()
        )
        return (last.attempt_number + 1) if last else 1

    def create_attempt(
        self,
        db: Session,
        history_session_id: int,
        score: int,
        grade: str,
        total_correct: int,
        total_wrong: int,
        questions_json: str,
        answers_json: str,
        evaluation_json: str,
        duration_seconds: Optional[int] = None,
    ) -> ExamAttempt:
        num = self.next_attempt_number(db, history_session_id)
        obj = ExamAttempt(
            history_session_id=history_session_id,
            attempt_number=num,
            score=score,
            grade=grade,
            total_correct=total_correct,
            total_wrong=total_wrong,
            duration_seconds=duration_seconds,
            questions_json=questions_json,
            answers_json=answers_json,
            evaluation_json=evaluation_json,
            created_at=datetime.datetime.utcnow(),
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj


class ExamReviewRepository(BaseRepository[ExamReview]):
    def __init__(self):
        super().__init__(ExamReview)

    def get_by_attempt(self, db: Session, attempt_id: int) -> List[ExamReview]:
        return (
            db.query(self.model)
            .filter(self.model.attempt_id == attempt_id)
            .order_by(self.model.question_number)
            .all()
        )

    def bulk_create(self, db: Session, rows: List[dict]) -> None:
        for row in rows:
            db.add(ExamReview(**row))
        db.commit()


class StudyPlanRepository(BaseRepository[StudyPlan]):
    def __init__(self):
        super().__init__(StudyPlan)

    def get_by_history_session(self, db: Session, history_session_id: int) -> Optional[StudyPlan]:
        return (
            db.query(self.model)
            .filter(self.model.history_session_id == history_session_id)
            .first()
        )


class StudyPlanItemRepository(BaseRepository[StudyPlanItem]):
    def __init__(self):
        super().__init__(StudyPlanItem)

    def get_by_plan(self, db: Session, plan_id: int) -> List[StudyPlanItem]:
        return (
            db.query(self.model)
            .filter(self.model.plan_id == plan_id)
            .order_by(self.model.order_number)
            .all()
        )

    def toggle_completed(self, db: Session, item_id: int) -> Optional[StudyPlanItem]:
        obj = self.get(db, item_id)
        if not obj:
            return None
        obj.completed = 0 if obj.completed else 1
        db.commit()
        db.refresh(obj)
        # Recalculate plan progress
        plan = db.query(StudyPlan).filter(StudyPlan.id == obj.plan_id).first()
        if plan:
            items = db.query(StudyPlanItem).filter(StudyPlanItem.plan_id == plan.id).all()
            done  = sum(1 for i in items if i.completed)
            plan.completed_days = done
            plan.progress = int((done / len(items)) * 100) if items else 0
            plan.updated_at = datetime.datetime.utcnow()
            db.commit()
        return obj


exam_history_session_repo = ExamHistorySessionRepository()
exam_attempt_repo         = ExamAttemptRepository()
exam_review_repo          = ExamReviewRepository()
study_plan_repo           = StudyPlanRepository()
study_plan_item_repo      = StudyPlanItemRepository()
