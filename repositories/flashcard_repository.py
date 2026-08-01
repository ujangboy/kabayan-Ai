from sqlalchemy.orm import Session
from models import Flashcard
from repositories.base import BaseRepository
from typing import List

class FlashcardRepository(BaseRepository[Flashcard]):
    def __init__(self):
        super().__init__(Flashcard)

flashcard_repository = FlashcardRepository()
