from repositories.settings_repository import setting_repository
from sqlalchemy.orm import Session

class SettingsService:
    def get_embedding_model(self, db: Session) -> str:
        setting = setting_repository.get_by_key(db, "embedding_model")
        return setting.value if setting else "all-MiniLM-L6-v2"

    def set_embedding_model(self, db: Session, model_name: str):
        setting_repository.set_value(db, "embedding_model", model_name)

settings_service = SettingsService()
