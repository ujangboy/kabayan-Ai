"""
Centralized Error Handler — Kabayan AI
Maps any internal exception to a safe, user-friendly response.
No traceback, no file paths, no SQL, no regex errors ever reach the frontend.
"""
import logging
from typing import Tuple

logger = logging.getLogger(__name__)


# ─── Safe message map ─────────────────────────────────────────────────────────
# Keyed on lowercase fragments found in str(exception).
# Order matters: more specific patterns first.

_PATTERNS: list[Tuple[list[str], int, str, str]] = [
    # (fragments_any_match, http_status, code, user_message)

    # Groq / AI rate limit
    (["rate_limit_local", "loop guard"],
     429, "AI_LOOP_GUARD",
     "Sistem anti-spam aktif. Tunggu sekitar 1 menit sebelum mengirim pesan lagi."),

    (["rate limit", "ratelimit", "429", "quota"],
     429, "AI_RATE_LIMIT",
     "Kuota AI sedang mencapai batas. Silakan coba beberapa menit lagi."),

    # Timeout / network
    (["timeout", "timed out", "read timeout", "connect timeout"],
     408, "TIMEOUT",
     "Koneksi timeout. Silakan coba lagi."),

    (["connection", "network", "502", "503", "504", "service unavailable"],
     503, "SERVICE_UNAVAILABLE",
     "Layanan sedang tidak tersedia. Silakan coba beberapa saat lagi."),

    # Database
    (["sqlite3", "sqlalchemy", "database is locked", "operationalerror",
      "integrityerror", "no such table", "unique constraint"],
     500, "DB_ERROR",
     "Gagal memproses data. Silakan muat ulang halaman."),

    # File / upload
    (["file not found", "no such file", "permission denied", "oserror"],
     500, "FILE_ERROR",
     "Gagal memproses file. Periksa kembali file yang diunggah."),

    # Validation
    (["validationerror", "pydantic", "value error", "invalid", "missing field"],
     422, "VALIDATION_ERROR",
     "Data yang dimasukkan belum valid. Periksa kembali isian Anda."),

    # JSON / parsing
    (["json", "decode", "parse", "jsondecode"],
     500, "PARSE_ERROR",
     "Terjadi kesalahan saat memproses respons AI. Silakan coba lagi."),

    # Not found
    (["not found", "does not exist", "404"],
     404, "NOT_FOUND",
     "Data tidak ditemukan."),

    # Auth (not currently used but future-proof)
    (["unauthorized", "401", "forbidden", "403"],
     401, "UNAUTHORIZED",
     "Silakan login kembali."),
]

_FALLBACK = (500, "INTERNAL_ERROR", "Terjadi kesalahan pada sistem. Silakan coba lagi.")


def classify(exc: Exception) -> Tuple[int, str, str]:
    """
    Return (http_status, error_code, safe_user_message).
    Never leaks internal details.
    """
    raw = str(exc).lower()

    for fragments, status, code, msg in _PATTERNS:
        if any(frag in raw for frag in fragments):
            return status, code, msg

    return _FALLBACK


def safe_response(exc: Exception, context: str = "") -> dict:
    """
    Build the standardized error response body.
    Log the real exception to terminal; return only safe fields.
    """
    status, code, message = classify(exc)
    # Full details go to terminal only
    logger.error(
        f"[{code}] {context or 'error'}: {repr(exc)}",
        exc_info=True,
    )
    return {
        "success": False,
        "code":    code,
        "message": message,
    }, status


def safe_json_response(exc: Exception, context: str = ""):
    """
    Convenience wrapper — returns a FastAPI JSONResponse directly.
    Import lazily to avoid circular imports at module load time.
    """
    from fastapi.responses import JSONResponse
    body, status = safe_response(exc, context)
    return JSONResponse(status_code=status, content=body)
