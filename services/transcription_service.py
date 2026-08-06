"""
Transcription Service (PRD US1.1) — transkripsi audio via Groq Whisper API.

Layanan umum yang diekstrak dari jalur fallback YouTube (sources/youtube_source.py):
pengguna dapat mengunggah rekaman audio kuliah (MP3/WAV/M4A/OGG/FLAC) dan
transkripnya diproses sebagai materi. 0 token lokal & 0 MB RAM — transkripsi
berjalan penuh di Groq API (whisper-large-v3).
"""
from __future__ import annotations

import logging
import os
from typing import Dict, Optional

import config

logger = logging.getLogger(__name__)

ALLOWED_AUDIO_EXTENSIONS = (".mp3", ".wav", ".m4a", ".ogg", ".flac")
MAX_AUDIO_SIZE_MB = 24  # batas unggah Groq ±25MB — jaga margin 1MB
WHISPER_MODEL = "whisper-large-v3"


def validate_audio(filename: Optional[str], size_bytes: int) -> None:
    """Validasi ekstensi + ukuran file audio. ValueError = pesan ramah user."""
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise ValueError(
            f"Format audio tidak didukung: '{ext or 'tanpa ekstensi'}'. "
            f"Gunakan: {', '.join(e.lstrip('.') for e in ALLOWED_AUDIO_EXTENSIONS)}"
        )
    size_mb = size_bytes / (1024 * 1024)
    if size_mb > MAX_AUDIO_SIZE_MB:
        raise ValueError(
            f"File audio terlalu besar ({size_mb:.0f}MB > {MAX_AUDIO_SIZE_MB}MB). "
            "Potong audio menjadi bagian yang lebih pendek lalu unggah ulang."
        )


def transcribe(file_path: str, validate_ext: bool = True) -> Dict:
    """Transkrip audio via Groq Whisper.

    Return {"text", "segments": [{"text", "start", "end"}], "duration", "language"}.
    Mengangkat ValueError untuk error yang bisa dipahami user.

    validate_ext=False untuk jalur internal (fallback YouTube yang mengunduh
    webm/opus — Groq menerimanya, walau bukan format upload user).
    """
    if not config.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY belum diatur — transkripsi audio tidak tersedia.")
    if not os.path.exists(file_path):
        raise ValueError("File audio tidak ditemukan di server.")

    from groq import Groq  # lazy import — dependency hanya diperlukan saat transkripsi

    validate_audio(os.path.basename(file_path), os.path.getsize(file_path)) if validate_ext else None

    client = Groq(api_key=config.GROQ_API_KEY)
    try:
        with open(file_path, "rb") as f:
            transcription = client.audio.transcriptions.create(
                file=(os.path.basename(file_path), f.read()),
                model=WHISPER_MODEL,
                response_format="verbose_json",
            )
    except Exception as e:
        logger.error(f"Groq Whisper gagal untuk {os.path.basename(file_path)}: {e}", exc_info=True)
        raise ValueError(_friendly_groq_error(e))

    if isinstance(transcription, dict):
        duration = int(transcription.get("duration") or 0)
        language = transcription.get("language") or "id"
        segments_raw = transcription.get("segments") or []
        text_content = transcription.get("text") or ""
    else:
        duration = int(getattr(transcription, "duration", 0) or 0)
        language = getattr(transcription, "language", "id") or "id"
        segments_raw = getattr(transcription, "segments", None) or []
        text_content = getattr(transcription, "text", "") or ""

    segments = []
    for seg in segments_raw:
        if isinstance(seg, dict):
            start = seg.get("start", 0.0) or 0.0
            end = seg.get("end", 0.0) or 0.0
            text = seg.get("text") or ""
        else:
            start = getattr(seg, "start", 0.0) or 0.0
            end = getattr(seg, "end", 0.0) or 0.0
            text = getattr(seg, "text", "") or ""
        segments.append({"text": text, "start": float(start), "end": float(end)})

    if not text_content and not segments:
        raise ValueError("Audio tampaknya kosong — tidak ada ucapan yang terdeteksi.")

    return {
        "text": text_content,
        "segments": segments,
        "duration": duration,
        "language": language,
    }


def _friendly_groq_error(exc: Exception) -> str:
    err_str = str(exc).lower()
    if "429" in err_str or "rate limit" in err_str:
        return "Batas permintaan transkripsi terlampaui. Coba lagi beberapa saat."
    if "timeout" in err_str or "timed out" in err_str:
        return "Waktu transkripsi habis (audio terlalu panjang). Potong audio lalu unggah ulang."
    if "invalid" in err_str and "file" in err_str:
        return "File audio rusak atau tidak dapat dibaca Groq."
    return f"Transkripsi gagal: {str(exc)[:160]}"
