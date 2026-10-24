from typing import Optional

from app.repositories.settings_repository import setting_repository
from sqlalchemy.orm import Session

# Kunci key di tabel Setting — dijaga di satu tempat agar konsisten.
SETTING_KEY_EMBEDDING_MODEL = "embedding_model"
SETTING_KEY_DISPLAY_NAME = "profile.display_name"
SETTING_KEY_PHOTO_PATH = "profile.photo_path"
SETTING_KEY_LANGUAGE = "app.language"
APP_DEFAULT_LANGUAGE = "id"
APP_VERSION = "0.1.1"


class SettingsService:
    def get_setting(self, db: Session, key: str, default: str = "") -> str:
        setting = setting_repository.get_by_key(db, key)
        return setting.value if setting and setting.value is not None else default

    def set_setting(self, db: Session, key: str, value: str, description: str = ""):
        if value is None:
            value = ""
        setting_repository.set_value(db, key, str(value), description)

    def get_embedding_model(self, db: Session) -> str:
        return self.get_setting(db, SETTING_KEY_EMBEDDING_MODEL, "all-MiniLM-L6-v2")

    def set_embedding_model(self, db: Session, model_name: str):
        self.set_setting(db, SETTING_KEY_EMBEDDING_MODEL, model_name)

    # ─── Profil (single-user local) ────────────────────────────────────
    def get_display_name(self, db: Session) -> str:
        return self.get_setting(db, SETTING_KEY_DISPLAY_NAME, "")

    def set_display_name(self, db: Session, name: str):
        self.set_setting(db, SETTING_KEY_DISPLAY_NAME, name.strip() if name else "")

    def get_photo_path(self, db: Session) -> str:
        return self.get_setting(db, SETTING_KEY_PHOTO_PATH, "")

    def set_photo_path(self, db: Session, photo_path: str):
        self.set_setting(db, SETTING_KEY_PHOTO_PATH, photo_path)

    # ─── Bahasa aplikasi ───────────────────────────────────────────────
    def get_language(self, db: Session) -> str:
        lang = self.get_setting(db, SETTING_KEY_LANGUAGE, "")
        # Lindungi dari value kosong/tidak valid (mis. data legacy hasil reset).
        return lang if lang in ("id", "en", "su") else APP_DEFAULT_LANGUAGE

    def set_language(self, db: Session, lang: str):
        if lang not in ("id", "en", "su"):
            raise ValueError(f"Bahasa tidak didukung: {lang}")
        self.set_setting(db, SETTING_KEY_LANGUAGE, lang)


settings_service = SettingsService()
