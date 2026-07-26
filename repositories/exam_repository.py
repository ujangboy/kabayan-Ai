from sqlalchemy.orm import Session
from sqlalchemy import desc
from models import ExamBlueprint, ExamSession
from repositories.base import BaseRepository
from typing import List, Optional
import datetime


class ExamBlueprintRepository(BaseRepository[ExamBlueprint]):
    def __init__(self):
        super().__init__(ExamBlueprint)

    def get_by_subject(self, db: Session, subject_id: int) -> List[ExamBlueprint]:
        return (
            db.query(self.model)
            .filter(self.model.subject_id == subject_id)
            .order_by(desc(self.model.created_at))
            .all()
        )

    def get_latest_by_subject(self, db: Session, subject_id: int) -> Optional[ExamBlueprint]:
        return (
            db.query(self.model)
            .filter(self.model.subject_id == subject_id)
            .order_by(desc(self.model.created_at))
            .first()
        )

    def create_blueprint(
        self,
        db: Session,
        subject_id: int,
        title: str,
        exam_type: str,
        difficulty: str,
        bloom_level: str,
        question_type: str,
        total_questions: int,
        duration_minutes: Optional[int],
        blueprint_json: str,
        analysis_json: Optional[str] = None,
    ) -> ExamBlueprint:
        obj = ExamBlueprint(
            subject_id=subject_id,
            title=title,
            exam_type=exam_type,
            difficulty=difficulty,
            bloom_level=bloom_level,
            question_type=question_type,
            total_questions=total_questions,
            duration_minutes=duration_minutes,
            blueprint_json=blueprint_json,
            analysis_json=analysis_json,
            created_at=datetime.datetime.utcnow(),
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj


class ExamSessionRepository(BaseRepository[ExamSession]):
    def __init__(self):
        super().__init__(ExamSession)

    def get_by_subject(self, db: Session, subject_id: int) -> List[ExamSession]:
        return (
            db.query(self.model)
            .filter(self.model.subject_id == subject_id)
            .order_by(desc(self.model.started_at))
            .all()
        )

    def get_by_blueprint(self, db: Session, blueprint_id: int) -> List[ExamSession]:
        return (
            db.query(self.model)
            .filter(self.model.blueprint_id == blueprint_id)
            .order_by(desc(self.model.started_at))
            .all()
        )

    def create_session(
        self,
        db: Session,
        blueprint_id: int,
        subject_id: int,
        questions_json: str,
    ) -> ExamSession:
        obj = ExamSession(
            blueprint_id=blueprint_id,
            subject_id=subject_id,
            questions_json=questions_json,
            started_at=datetime.datetime.utcnow(),
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    def submit_session(
        self,
        db: Session,
        session_id: int,
        answers_json: str,
        score: int,
        total_correct: int,
        total_wrong: int,
        evaluation_json: str,
    ) -> Optional[ExamSession]:
        obj = self.get(db, session_id)
        if not obj:
            return None
        obj.answers_json = answers_json
        obj.score = score
        obj.total_correct = total_correct
        obj.total_wrong = total_wrong
        obj.evaluation_json = evaluation_json
        obj.submitted_at = datetime.datetime.utcnow()
        db.commit()
        db.refresh(obj)
        return obj

    def get_recent(self, db: Session, limit: int = 10) -> List[ExamSession]:
        return (
            db.query(self.model)
            .order_by(desc(self.model.started_at))
            .limit(limit)
            .all()
        )


exam_blueprint_repository = ExamBlueprintRepository()
exam_session_repository = ExamSessionRepository()
