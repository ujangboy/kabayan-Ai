from sqlalchemy.orm import Session
from models import Material
from repositories.base import BaseRepository
from typing import List

class MaterialRepository(BaseRepository[Material]):
    def __init__(self):
        super().__init__(Material)

    def get_by_subject(self, db: Session, subject_id: int) -> List[Material]:
        return db.query(self.model).filter(self.model.subject_id == subject_id).all()

material_repository = MaterialRepository()
