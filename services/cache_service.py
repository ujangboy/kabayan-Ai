import hashlib
from sqlalchemy.orm import Session
from repositories.cache_repository import cache_repository

class CacheService:
    @staticmethod
    def _hash(text: str) -> str:
        return hashlib.sha256(str(text).encode('utf-8')).hexdigest()

    @staticmethod
    def get_cache(db: Session, prompt: str, context: str, setting: str) -> str:
        prompt_hash = CacheService._hash(prompt)
        context_hash = CacheService._hash(context)
        setting_hash = CacheService._hash(setting)
        
        cached = cache_repository.get_cache(db, prompt_hash, context_hash, setting_hash)
        return cached.response if cached else None

    @staticmethod
    def set_cache(db: Session, prompt: str, context: str, setting: str, response: str):
        prompt_hash = CacheService._hash(prompt)
        context_hash = CacheService._hash(context)
        setting_hash = CacheService._hash(setting)
        
        cache_repository.create(db, {
            "prompt_hash": prompt_hash,
            "context_hash": context_hash,
            "setting_hash": setting_hash,
            "response": response
        })

    @staticmethod
    def invalidate_all(db: Session):
        cache_repository.invalidate_all(db)

cache_service = CacheService()
