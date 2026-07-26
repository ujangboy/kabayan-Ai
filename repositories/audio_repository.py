from sqlalchemy.orm import Session
from models import AudioGeneration
from repositories.base import BaseRepository
from typing import Optional

class AudioRepository(BaseRepository[AudioGeneration]):
    def __init__(self):
        super().__init__(AudioGeneration)

    def get_by_material_id(self, db: Session, material_id: int) -> Optional[AudioGeneration]:
        return db.query(self.model).filter(self.model.material_id == material_id).first()

    def update_status(self, db: Session, id: int, status: str, filepath: str = None, engine_used: str = None) -> AudioGeneration:
        obj = self.get(db, id)
        if obj:
            obj.status = status
            if filepath:
                obj.filepath = filepath
            if engine_used:
                obj.engine_used = engine_used
            db.commit()
            db.refresh(obj)
        return obj

audio_repository = AudioRepository()
