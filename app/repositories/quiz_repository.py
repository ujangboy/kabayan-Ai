from sqlalchemy.orm import Session
from app.models import Quiz
from app.repositories.base import BaseRepository
from typing import List

class QuizRepository(BaseRepository[Quiz]):
    def __init__(self):
        super().__init__(Quiz)

quiz_repository = QuizRepository()
