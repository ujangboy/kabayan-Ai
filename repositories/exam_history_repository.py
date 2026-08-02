from sqlalchemy.orm import Session
from sqlalchemy import desc
from models import (
    ExamAttempt,
    StudyPlan, StudyPlanItem
)
from repositories.base import BaseRepository
from typing import List, Optional
import datetime


class ExamAttemptRepository(BaseRepository[ExamAttempt]):
    def __init__(self):
        super().__init__(ExamAttempt)

    def get_by_session(self, db: Session, session_id: int) -> List[ExamAttempt]:
        return (
            db.query(self.model)
            .filter(self.model.session_id == session_id)
            .order_by(self.model.attempt_number)
            .all()
        )

    def next_attempt_number(self, db: Session, session_id: int) -> int:
        last = (
            db.query(self.model)
            .filter(self.model.session_id == session_id)
            .order_by(desc(self.model.attempt_number))
            .first()
        )
        return (last.attempt_number + 1) if last else 1


class StudyPlanRepository(BaseRepository[StudyPlan]):
    def __init__(self):
        super().__init__(StudyPlan)

    def get_by_session(self, db: Session, session_id: int) -> Optional[StudyPlan]:
        return (
            db.query(self.model)
            .filter(self.model.session_id == session_id)
            .first()
        )


class StudyPlanItemRepository(BaseRepository[StudyPlanItem]):
    def __init__(self):
        super().__init__(StudyPlanItem)

    def _recalc_plan_progress(self, db: Session, plan_id: int):
        plan = db.query(StudyPlan).filter(StudyPlan.id == plan_id).first()
        if not plan:
            return
        items = db.query(StudyPlanItem).filter(StudyPlanItem.plan_id == plan.id).all()
        done  = sum(1 for i in items if i.completed)
        plan.completed_days = done
        plan.progress = int((done / len(items)) * 100) if items else 0
        plan.updated_at = datetime.datetime.utcnow()
        db.flush()

    def toggle_completed(self, db: Session, item_id: int) -> Optional[StudyPlanItem]:
        obj = self.get(db, item_id)
        if not obj:
            return None
        obj.completed = 0 if obj.completed else 1
        db.flush()
        db.refresh(obj)
        self._recalc_plan_progress(db, obj.plan_id)
        return obj

    def set_completed(self, db: Session, item_id: int, completed: int = 1) -> Optional[StudyPlanItem]:
        obj = self.get(db, item_id)
        if not obj:
            return None
        obj.completed = 1 if completed else 0
        db.flush()
        db.refresh(obj)
        self._recalc_plan_progress(db, obj.plan_id)
        return obj


exam_attempt_repo    = ExamAttemptRepository()
study_plan_repo      = StudyPlanRepository()
study_plan_item_repo = StudyPlanItemRepository()
