"""
Akumulasi pemakaian Groq API per fitur — untuk halaman Pengaturan > Limit AI.

Mencatat estimasi token + jumlah panggilan per fitur (capability) sebagai
pasangan key-value di tabel `Setting` (tanpa migrasi DB). Semua panggilan AI
yang benar-benar memanggil Groq (bukan cache hit) harus mencatat di sini.

Estimasi token memakai heuristik output (len(text) // 4), konsisten dengan
penghitungan tutor sebelumnya — ini perkiraan, bukan angka eksak dari API.
"""
import logging

from sqlalchemy.orm import Session

from repositories.settings_repository import setting_repository

logger = logging.getLogger(__name__)

# Prefix key di tabel Setting.
KEY_PREFIX_TOKENS = "usage.{feature}.tokens"
KEY_PREFIX_CALLS = "usage.{feature}.calls"


def _key_tokens(feature: str) -> str:
    return KEY_PREFIX_TOKENS.format(feature=feature)


def _key_calls(feature: str) -> str:
    return KEY_PREFIX_CALLS.format(feature=feature)


def _to_int(value: str) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _increment(db: Session, key: str, amount: int = 1) -> None:
    """Baca lalu tambahkan nilai kumulatif pada satu Setting key."""
    setting = setting_repository.get_by_key(db, key)
    current = _to_int(setting.value) if setting else 0
    setting_repository.set_value(db, key, str(current + amount))


def record_usage(db: Session, feature: str, response_text: str | None = None) -> None:
    """Catat satu panggilan Groq untuk sebuah fitur.

    feature  : capability/nama fitur, mis. "quiz", "exam_question", "tutor".
    response_text: teks respons untuk mengestimasi token (opsional).
    """
    if not feature:
        return
    tokens = len(response_text or "") // 4
    try:
        _increment(db, _key_calls(feature))
        if tokens > 0:
            _increment(db, _key_tokens(feature), tokens)
        db.commit()
    except Exception as exc:
        # Pencatatan usage tidak boleh mengganggu jalur utama AI.
        logger.warning("[Usage] Gagal mencatat pemakaian %s: %r", feature, exc)
        try:
            db.rollback()
        except Exception:
            pass


def get_usage(db: Session) -> dict:
    """Kumpulan pemakaian per fitur + total, untuk ditampilkan di UI."""
    import models
    settings = db.query(models.Setting).filter(models.Setting.key.like("usage.%")).all()

    features: dict[str, dict] = {}
    total_tokens = 0
    total_calls = 0
    for s in settings:
        if not s.key.startswith("usage."):
            continue
        parts = s.key.split(".")
        if len(parts) < 3:
            continue
        feature = parts[1]
        kind = parts[2]
        entry = features.setdefault(feature, {"feature": feature, "tokens": 0, "calls": 0})
        if kind == "tokens":
            entry["tokens"] = _to_int(s.value)
        elif kind == "calls":
            entry["calls"] = _to_int(s.value)

    for entry in features.values():
        total_tokens += entry["tokens"]
        total_calls += entry["calls"]

    return {
        "features": list(features.values()),
        "total_tokens": total_tokens,
        "total_calls": total_calls,
    }