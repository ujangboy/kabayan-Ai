from sqlalchemy.orm import Session
from sqlalchemy import desc
from models import ExamBlueprint, ExamSession
from repositories.base import BaseRepository
from typing import Optional
import datetime


class ExamBlueprintRepository(BaseRepository[ExamBlueprint]):
    def __init__(self):
        super().__init__(ExamBlueprint)

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
        db.flush()
        db.refresh(obj)
        return obj


class ExamSessionRepository(BaseRepository[ExamSession]):
    def __init__(self):
        super().__init__(ExamSession)

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
        db.flush()
        db.refresh(obj)
        return obj


exam_blueprint_repository = ExamBlueprintRepository()
exam_session_repository = ExamSessionRepository()
