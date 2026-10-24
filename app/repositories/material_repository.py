from sqlalchemy.orm import Session
from app.models import Material
from app.repositories.base import BaseRepository
from typing import List

class MaterialRepository(BaseRepository[Material]):
    def __init__(self):
        super().__init__(Material)

    def get_by_subject(self, db: Session, subject_id: int) -> List[Material]:
        """Kembalikan materi aktif (bukan sampah) untuk sebuah subject."""
        return (db.query(self.model)
                .filter(self.model.subject_id == subject_id)
                .filter(self.model.status != "Trashed")
                .all())

    def get_all(self, db: Session, skip: int = 0, limit: int = 50) -> List[Material]:
        """Kembalikan materi aktif (bukan sampah)."""
        return (db.query(self.model)
                .filter(self.model.status != "Trashed")
                .offset(skip).limit(limit).all())

material_repository = MaterialRepository()
