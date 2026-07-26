from sqlalchemy.orm import Session
from models import Quiz
from repositories.base import BaseRepository
from typing import List

class QuizRepository(BaseRepository[Quiz]):
    def __init__(self):
        super().__init__(Quiz)

    def get_by_subject(self, db: Session, subject_id: int) -> List[Quiz]:
        return db.query(self.model).filter(self.model.subject_id == subject_id).all()

quiz_repository = QuizRepository()
