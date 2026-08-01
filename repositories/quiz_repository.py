from sqlalchemy.orm import Session
from models import Quiz
from repositories.base import BaseRepository
from typing import List

class QuizRepository(BaseRepository[Quiz]):
    def __init__(self):
        super().__init__(Quiz)

quiz_repository = QuizRepository()
