from repositories.subject_repository import subject_repository
from services.cache_service import cache_service
from sqlalchemy.orm import Session
from models import Subject
from typing import List, Optional

class SubjectService:
    @staticmethod
    def get_all(db: Session) -> List[Subject]:
        return subject_repository.get_all(db)

    @staticmethod
    def get_by_id(db: Session, id: int) -> Optional[Subject]:
        return subject_repository.get(db, id)

    @staticmethod
    def create(db: Session, name: str, semester: str, lecturer: str, description: str) -> Subject:
        return subject_repository.create(db, {
            "name": name,
            "semester": semester,
            "lecturer": lecturer,
            "description": description
        })

    @staticmethod
    def delete(db: Session, id: int) -> bool:
        success = subject_repository.delete(db, id)
        if success:
            cache_service.invalidate_all(db)
        return success

subject_service = SubjectService()
