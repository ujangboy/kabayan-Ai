from sqlalchemy.orm import Session
from models import Flashcard
from repositories.base import BaseRepository
from typing import List

class FlashcardRepository(BaseRepository[Flashcard]):
    def __init__(self):
        super().__init__(Flashcard)

    def get_by_subject(self, db: Session, subject_id: int) -> List[Flashcard]:
        return db.query(self.model).filter(self.model.subject_id == subject_id).all()

flashcard_repository = FlashcardRepository()
