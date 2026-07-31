from sqlalchemy.orm import Session
from models import Note
from repositories.base import BaseRepository

class NoteRepository(BaseRepository[Note]):
    def __init__(self):
        super().__init__(Note)

note_repository = NoteRepository()
