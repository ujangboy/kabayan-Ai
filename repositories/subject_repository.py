from sqlalchemy.orm import Session
from models import Subject
from repositories.base import BaseRepository

class SubjectRepository(BaseRepository[Subject]):
    def __init__(self):
        super().__init__(Subject)

subject_repository = SubjectRepository()
