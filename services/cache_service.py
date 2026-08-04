import hashlib
import datetime
from sqlalchemy.orm import Session
from repositories.cache_repository import cache_repository
from models import Cache

# B4: batas cache — TTL 7 hari + maksimal entri agar tidak tumbuh tak terkendali
CACHE_TTL_SECONDS = 7 * 24 * 3600
MAX_CACHE_ENTRIES = 5000


class CacheService:
    def _hash(self, text: str) -> str:
        return hashlib.sha256(str(text).encode('utf-8')).hexdigest()

    def get_cache(self, db: Session, prompt: str, context: str, setting: str) -> str:
        prompt_hash = self._hash(prompt)
        context_hash = self._hash(context)
        setting_hash = self._hash(setting)

        cached = cache_repository.get_cache(db, prompt_hash, context_hash, setting_hash)
        if cached:
            # TTL: entri yang sudah kedaluwarsa dihapus dan dianggap miss
            if cached.expired_at and cached.expired_at < datetime.datetime.utcnow():
                db.delete(cached)
                db.commit()
                return None
            return cached.response if cached.response else None
        return None

    def set_cache(self, db: Session, prompt: str, context: str, setting: str, response: str):
        prompt_hash = self._hash(prompt)
        context_hash = self._hash(context)
        setting_hash = self._hash(setting)

        expires = datetime.datetime.utcnow() + datetime.timedelta(seconds=CACHE_TTL_SECONDS)

        existing = db.query(Cache).filter(
            Cache.prompt_hash == prompt_hash,
            Cache.context_hash == context_hash,
            Cache.setting_hash == setting_hash
        ).first()
        if existing:
            existing.response = response
            existing.expired_at = expires
        else:
            db.add(Cache(
                prompt_hash=prompt_hash,
                context_hash=context_hash,
                setting_hash=setting_hash,
                response=response,
                expired_at=expires,
            ))
        db.flush()
        # Batasi ukuran: jika melebihi MAX_CACHE_ENTRIES, buang entri terlama
        total = db.query(Cache).count()
        if total > MAX_CACHE_ENTRIES:
            overflow = db.query(Cache).order_by(Cache.id.asc()).limit(total - MAX_CACHE_ENTRIES).all()
            for c in overflow:
                db.delete(c)
        # COMMIT PENTING: tanpa commit, perubahan hilang saat session ditutup
        # (session.close() me-rollback transaksi yang belum di-commit)
        db.commit()

    def invalidate_all(self, db: Session):
        cache_repository.invalidate_all(db)
        db.commit()


cache_service = CacheService()
