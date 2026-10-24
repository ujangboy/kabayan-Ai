from sqlalchemy.orm import Session
from app.models import Note
from app.repositories.base import BaseRepository

class NoteRepository(BaseRepository[Note]):
    def __init__(self):
        super().__init__(Note)

note_repository = NoteRepository()
