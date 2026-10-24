from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models import (
    ExamAttempt,
    StudyPlan, StudyPlanItem
)
from app.repositories.base import BaseRepository
from typing import List, Optional
import datetime
from app.time_utils import utcnow


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
        plan.updated_at = utcnow()
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

    def get_by_plan(self, db: Session, plan_id: int) -> List[StudyPlanItem]:
        return (
            db.query(StudyPlanItem)
            .filter(StudyPlanItem.plan_id == plan_id)
            .order_by(StudyPlanItem.order_number)
            .all()
        )

    def delete(self, db: Session, item_id: int) -> bool:
        obj = self.get(db, item_id)
        if not obj:
            return False
        plan_id = obj.plan_id
        db.delete(obj)
        db.flush()
        # Recalculate plan progress (completed_days/progress) after removal.
        self._recalc_plan_progress(db, plan_id)
        return True


exam_attempt_repo    = ExamAttemptRepository()
study_plan_repo      = StudyPlanRepository()
study_plan_item_repo = StudyPlanItemRepository()
