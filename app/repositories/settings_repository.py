from sqlalchemy.orm import Session
from app.models import Setting
from app.repositories.base import BaseRepository
from typing import Optional

class SettingRepository(BaseRepository[Setting]):
    def __init__(self):
        super().__init__(Setting)

    def get_by_key(self, db: Session, key: str) -> Optional[Setting]:
        return db.query(self.model).filter(self.model.key == key).first()

    def set_value(self, db: Session, key: str, value: str, description: str = ""):
        setting = self.get_by_key(db, key)
        if setting:
            setting.value = value
            if description:
                setting.description = description
            db.flush()
            db.refresh(setting)
            return setting
        else:
            return self.create(db, {"key": key, "value": value, "description": description})

setting_repository = SettingRepository()
