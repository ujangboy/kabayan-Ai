"""
Centralized Error Handler — Kabayan AI.

Unified error handling system that:
1. Handles AppError (from exceptions.py) with its specific status/message
2. Pattern-matches unknown exceptions to safe user-friendly messages
3. Logs everything to terminal, never leaks internals to frontend
4. Provides register_all_handlers(app) for one-call setup
"""

import logging
from typing import Tuple

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from exceptions import AppError

logger = logging.getLogger(__name__)

# ─── Safe message map (for non-AppError exceptions) ──────────────────
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

    # Groq API key auth — must come BEFORE generic "invalid" validation match
    (["invalid api key", "invalid_api_key", "authentication_error", "groq.apikey", "authenticationerror"],
     503, "GROQ_AUTH_ERROR",
     "Groq API key tidak valid. Periksa konfigurasi .env dan restart backend."),

    # Context too large (Groq 413 / TPM / context length) — before generic 500
    (["413", "request too large", "payload too large", "tokens per minute", "tokens_exceeded",
      "tpm", "context_length_exceeded", "context length", "maximum context length"],
     413, "CONTEXT_TOO_LARGE",
     "Konteks terlalu panjang untuk model ini (batas 8000 token/menit). Coba: kurangi dokumen terpilih, mulai chat baru, atau ringkas pertanyaanmu."),

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

    # Not found
    (["not found", "does not exist", "no such file", "404"],
     404, "NOT_FOUND",
     "Data tidak ditemukan."),

    # File / upload
    (["permission denied", "oserror"],
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

    # Auth
    (["unauthorized", "401", "forbidden", "403"],
     401, "UNAUTHORIZED",
     "Silakan login kembali."),
]

_FALLBACK = (500, "INTERNAL_ERROR", "Terjadi kesalahan pada sistem. Silakan coba lagi.")


def classify(exc: Exception) -> Tuple[int, str, str]:
    """
    Return (http_status, error_code, safe_user_message).
    Never leaks internal details.

    If exc is AppError, use its own status_code and message.
    Otherwise, pattern-match against _PATTERNS.
    """
    if isinstance(exc, AppError):
        return exc.status_code, "APP_ERROR", exc.message

    raw = str(exc).lower()

    for fragments, status, code, msg in _PATTERNS:
        if any(frag in raw for frag in fragments):
            return status, code, msg

    return _FALLBACK


def safe_response(exc: Exception, context: str = "") -> Tuple[dict, int]:
    """
    Build the standardized error response body.
    Log the real exception to terminal; return only safe fields.
    """
    status, code, message = classify(exc)

    logger.error(
        f"[{code}] {context or 'error'}: {repr(exc)}",
        exc_info=not isinstance(exc, AppError),
    )

    body: dict = {"detail": message}
    if isinstance(exc, AppError):
        body["detail"] = exc.message
        body["code"] = code
        if exc.detail is not None:
            body["data"] = exc.detail

    return body, status


def safe_json_response(exc: Exception, context: str = ""):
    """Return a FastAPI JSONResponse directly."""
    body, status = safe_response(exc, context)
    return JSONResponse(status_code=status, content=body)


# ─── Exception handlers for FastAPI app ─────────────────────────────

def register_all_handlers(app: FastAPI) -> None:
    """Register all exception handlers on a FastAPI app in one call."""

    @app.exception_handler(AppError)
    async def _app_error_handler(request: Request, exc: AppError):
        return safe_json_response(exc, context=f"AppError [{request.method} {request.url.path}]")

    @app.exception_handler(ValueError)
    async def _value_error_handler(request: Request, exc: ValueError):
        return safe_json_response(exc, context=f"ValueError [{request.method} {request.url.path}]")

    @app.exception_handler(StarletteHTTPException)
    async def _http_exception_handler(request: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    @app.exception_handler(Exception)
    async def _generic_error_handler(request: Request, exc: Exception):
        return safe_json_response(exc, context=f"global [{request.method} {request.url.path}]")