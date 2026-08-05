"""Profil pengguna (single-user lokal) — nama tampilan, foto profil, dan preferensi.

Aplikasi ini tidak memiliki tabel users; profil disimpan sebagai pasangan
key-value di tabel `Setting` (lihat services.settings_service). Foto profil
disimpan di `static/profile/` dan dilayani via mount `/static`.
"""
import os
import uuid
import logging

from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from services.settings_service import settings_service, APP_DEFAULT_LANGUAGE
from exceptions import AppError
import config

logger = logging.getLogger(__name__)

router = APIRouter()

# Ekstensi foto yang diizinkan (huruf kecil) + batas ukuran.
ALLOWED_PHOTO_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
MAX_PHOTO_BYTES = 5 * 1024 * 1024  # 5MB
PROFILE_DIR = os.path.join(config.BASE_DIR, "static", "profile")


class ProfileUpdate(BaseModel):
    display_name: str = Field("", max_length=120)
    language: str = Field(APP_DEFAULT_LANGUAGE, max_length=8)


@router.get("/api/profile")
async def get_profile(db: Session = Depends(get_db)):
    """Ambil profil: nama tampilan, foto, dan bahasa aplikasi."""
    try:
        return JSONResponse({
            "display_name": settings_service.get_display_name(db),
            "photo_path": settings_service.get_photo_path(db),
            "language": settings_service.get_language(db),
        })
    except AppError:
        raise
    except Exception as exc:
        raise AppError(str(exc), status_code=500)


@router.put("/api/profile")
async def update_profile(payload: ProfileUpdate, db: Session = Depends(get_db)):
    """Perbarui nama tampilan dan/atau preferensi bahasa."""
    try:
        settings_service.set_display_name(db, payload.display_name)
        settings_service.set_language(db, payload.language)
        db.commit()
        return JSONResponse({
            "status": "success",
            "display_name": settings_service.get_display_name(db),
            "language": settings_service.get_language(db),
        })
    except ValueError as exc:
        raise AppError(str(exc), status_code=400)
    except AppError:
        raise
    except Exception as exc:
        raise AppError(str(exc), status_code=500)


@router.post("/api/profile/photo")
async def upload_profile_photo(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Unggah foto profil. Simpan ke static/profile/ dan simpan jalurnya di Setting."""
    original = (file.filename or "").lower()
    ext = os.path.splitext(original)[1]
    if ext not in ALLOWED_PHOTO_EXTENSIONS:
        raise AppError(
            "Format foto tidak didukung. Gunakan: PNG, JPG, JPEG, WEBP, atau GIF.",
            status_code=400,
        )

    data = await file.read()
    if len(data) == 0:
        raise AppError("File kosong.", status_code=400)
    if len(data) > MAX_PHOTO_BYTES:
        raise AppError("Ukuran foto melebihi batas 5MB.", status_code=400)

    # Validasi magic bytes ringan untuk file gambar, cegah file palsu.
    if not _looks_like_image(data, ext):
        raise AppError("File bukan gambar yang valid.", status_code=400)

    try:
        os.makedirs(PROFILE_DIR, exist_ok=True)
        # Hapus foto lama jika ada (hindari penumpukan sampah di static/profile/).
        previous = settings_service.get_photo_path(db)
        if previous:
            _try_remove_photo(previous)

        filename = f"{uuid.uuid4().hex}{ext}"
        full_path = os.path.join(PROFILE_DIR, filename)
        with open(full_path, "wb") as f:
            f.write(data)

        photo_path = f"/static/profile/{filename}"
        settings_service.set_photo_path(db, photo_path)
        db.commit()
        return JSONResponse({"status": "success", "photo_path": photo_path})
    except AppError:
        raise
    except Exception as exc:
        logger.error(f"[Profile] Upload foto gagal: {exc!r}", exc_info=True)
        raise AppError("Gagal menyimpan foto profil. Silakan coba lagi.", status_code=500)


def _looks_like_image(data: bytes, ext: str) -> bool:
    """Validasi magic bytes gambar. Return False jika jelas bukan gambar."""
    if ext == ".png" and data[:8] == b"\x89PNG\r\n\x1a\n":
        return True
    if ext in (".jpg", ".jpeg") and data[:3] == b"\xff\xd8\xff":
        return True
    if ext == ".gif" and data[:6] in (b"GIF87a", b"GIF89a"):
        return True
    if ext == ".webp" and data[0:4] == b"RIFF" and data[8:12] == b"WEBP":
        return True
    return False


def _try_remove_photo(photo_path: str) -> None:
    """Best-effort hapus foto lama dari disk (tanpa melempar error)."""
    if not photo_path or not photo_path.startswith("/static/profile/"):
        return
    relative = photo_path.lstrip("/")  # static/profile/xxx.ext
    full = os.path.join(config.BASE_DIR, relative)
    try:
        if os.path.isfile(full):
            os.remove(full)
            logger.info(f"[Profile] Foto lama dihapus: {full}")
    except Exception as e:
        logger.warning(f"[Profile] Gagal hapus foto lama {full}: {e}")