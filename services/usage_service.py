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
from sqlalchemy import func

import models
from repositories.settings_repository import setting_repository
from time_utils import utcnow

logger = logging.getLogger(__name__)

# Prefix key di tabel Setting (akumulasi seumur hidup, untuk period="all").
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
    """Baca lalu tambahkan nilai kumulatif pada satu Setting key (atomic)."""
    setting = setting_repository.get_by_key(db, key)
    current = _to_int(setting.value) if setting else 0
    setting_repository.set_value(db, key, str(current + amount))


def record_usage(db: Session, feature: str, response_text: str | None = None,
                 prompt_text: str | None = None) -> None:
    """Catat satu panggilan Groq untuk sebuah fitur.

    `tokens` mengestimasi input + output (len(text) // 4) agar halaman Limit AI
    mencerminkan biaya sebenarnya, termasuk efek pemangkasan prompt/konteks.

    Mencatat ke dua lokasi:
      - `usage_logs` (per-panggilan, untuk jendela sliding 24h)
      - `Setting` `usage.*` (akumulasi seumur hidup, untuk period="all")
    """
    if not feature:
        return
    tokens = (len(response_text or "") + len(prompt_text or "")) // 4
    try:
        # Log per-panggilan (sliding 24h).
        db.add(models.UsageLog(
            feature=feature,
            tokens=tokens,
            calls=1,
            created_at=utcnow(),
        ))
        # Akumulasi seumur hidup.
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


def get_usage(db: Session, period: str = "24h") -> dict:
    """Kumpulan pemakaian per fitur + total.

    period:
      - "24h" : total dalam 24 jam terakhir (sliding window, default).
      - "all" : akumulasi seumur hidup dari Setting `usage.*`.
    """
    if period != "24h":
        return _get_usage_all(db)

    since = utcnow() - __import__("datetime").timedelta(hours=24)

    rows = (
        db.query(
            models.UsageLog.feature,
            func.coalesce(func.sum(models.UsageLog.tokens), 0),
            func.coalesce(func.sum(models.UsageLog.calls), 0),
        )
        .filter(models.UsageLog.created_at >= since)
        .group_by(models.UsageLog.feature)
        .all()
    )

    features: dict[str, dict] = {}
    total_tokens = 0
    total_calls = 0
    for feature, toks, calls in rows:
        features[feature] = {"feature": feature, "tokens": int(toks), "calls": int(calls)}
        total_tokens += int(toks)
        total_calls += int(calls)

    # Waktu reset = 24 jam sejak catatan paling awal di dalam jendela (rolling).
    # Jika tidak ada catatan, reset = 24 jam sejak sekarang.
    oldest = (
        db.query(func.min(models.UsageLog.created_at))
        .filter(models.UsageLog.created_at >= since)
        .scalar()
    )
    if oldest:
        from datetime import timedelta
        resets_at = oldest + timedelta(hours=24)
    else:
        resets_at = utcnow() + __import__("datetime").timedelta(hours=24)

    return {
        "features": list(features.values()),
        "total_tokens": total_tokens,
        "total_calls": total_calls,
        "period": "24h",
        "resets_at": resets_at.isoformat() if hasattr(resets_at, "isoformat") else str(resets_at),
    }


def _get_usage_all(db: Session) -> dict:
    """Akumulasi seumur hidup dari Setting `usage.*`."""
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
        "period": "all",
        "resets_at": None,
    }