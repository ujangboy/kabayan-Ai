from sqlalchemy.orm import Session
from models import Note
from repositories.base import BaseRepository
from typing import List

class NoteRepository(BaseRepository[Note]):
    def __init__(self):
        super().__init__(Note)

    def get_by_subject(self, db: Session, subject_id: int) -> List[Note]:
        return db.query(self.model).filter(self.model.subject_id == subject_id).all()

note_repository = NoteRepository()
