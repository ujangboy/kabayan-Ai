"""Persiapan gambar untuk lampiran chat (vision).

Validasi magic bytes → koreksi orientasi (EXIF) → resize ke batas
CHAT_IMAGE_MAX_DIM → encoder JPEG q85 → data URL base64.
Gambar TIDAK disimpan ke disk (v1) — hanya dikirim ke model vision.
"""
import base64
import io
import logging

from PIL import Image, ImageOps

from app import config
from app.exceptions import AppError

logger = logging.getLogger(__name__)

# Magic bytes format yang diterima (decoding dilakukan Pillow).
_MAGIC_ALLOWED = [
    b"\x89PNG\r\n\x1a\n",  # PNG
    b"\xff\xd8\xff",       # JPEG
    b"RIFF",               # WEBP (diikuti "WEBP" pada offset 8)
]


def prepare_image(data: bytes) -> str:
    """Validasi + kompres gambar mentah menjadi data URL JPEG.

    Raises AppError (status 400) bila bukan gambar yang didukung,
    kosong, terlalu besar, atau korup.
    """
    if len(data) > config.CHAT_IMAGE_MAX_MB * 1024 * 1024:
        raise AppError(
            f"Ukuran gambar terlalu besar (maksimal {config.CHAT_IMAGE_MAX_MB} MB).",
            status_code=400,
        )
    if not any(data.startswith(magic) for magic in _MAGIC_ALLOWED):
        raise AppError(
            "Format gambar tidak didukung. Gunakan JPG, PNG, atau WEBP.",
            status_code=400,
        )
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except Exception:
        raise AppError("Gambar tidak dapat dibaca (file korup?).", status_code=400)

    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    img.thumbnail((config.CHAT_IMAGE_MAX_DIM, config.CHAT_IMAGE_MAX_DIM))

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"
