from sqlalchemy.orm import Session
from models import Cache
from repositories.base import BaseRepository
from typing import Optional
import datetime

class CacheRepository(BaseRepository[Cache]):
    def __init__(self):
        super().__init__(Cache)

    def get_cache(self, db: Session, prompt_hash: str, context_hash: str, setting_hash: str) -> Optional[Cache]:
        return db.query(self.model).filter(
            self.model.prompt_hash == prompt_hash,
            self.model.context_hash == context_hash,
            self.model.setting_hash == setting_hash,
            (self.model.expired_at == None) | (self.model.expired_at > datetime.datetime.utcnow())
        ).first()

    def invalidate_all(self, db: Session):
        db.query(self.model).update({self.model.expired_at: datetime.datetime.utcnow()})
        db.commit()

cache_repository = CacheRepository()
