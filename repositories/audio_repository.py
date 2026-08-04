import logging
from sqlalchemy.orm import Session
from models import AudioGeneration
from repositories.base import BaseRepository
from typing import Optional

logger = logging.getLogger(__name__)

class AudioRepository(BaseRepository[AudioGeneration]):
    def __init__(self):
        super().__init__(AudioGeneration)

    def get_by_material_id(self, db: Session, material_id: int) -> Optional[AudioGeneration]:
        return db.query(self.model).filter(self.model.material_id == material_id).first()

    def update_status(self, db: Session, id: int, status: str, filepath: str = None, engine_used: str = None, failure_reason: str = None, stage: str = None) -> AudioGeneration:
        obj = self.get(db, id)
        if obj:
            obj.status = status
            if filepath:
                obj.filepath = filepath
            if engine_used:
                obj.engine_used = engine_used
            obj.failure_reason = failure_reason
            if stage is not None:
                obj.stage = stage
            db.commit()
            db.refresh(obj)
        else:
            logger.warning(f"AudioGeneration row {id} sudah tidak ada (mungkin cascade-delete), status {status} tidak dapat disimpan")
        return obj

    def delete_by_material_id(self, db: Session, material_id: int) -> bool:
        obj = self.get_by_material_id(db, material_id)
        if obj:
            db.delete(obj)
            db.commit()
            return True
        return False

audio_repository = AudioRepository()
