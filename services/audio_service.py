"""
Audio TTS service (EdgeTTS) — generate audio penuh dari isi materi.

Alur:
  1. Ambil teks materi via parsers.document_parser.extract_text
  2. Potong teks per ~800 char (batas aman EdgeTTS)
  3. Generate tiap potongan jadi MP3 via EdgeTTS (background thread)
  4. Gabungkan semua potongan dengan ffmpeg (binary dari imageio-ffmpeg)
  5. Simpan hasil ke storage/static/audio/<uuid>.mp3, update progres & status

Generate berjalan di background thread agar user bisa pindah menu (job
ditrack di frontend via jobStore + BackgroundProcessSync). Pembatalan
menggunakan threading.Event per id.
"""
import os
import re
import uuid
import asyncio
import threading
import tempfile
import subprocess

import edge_tts
from imageio_ffmpeg import get_ffmpeg_exe

from database import SessionLocal
from models import AudioGeneration
import models
from parsers.document_parser import extract_text
import config

AUDIO_DIR = os.path.join(config.STORAGE_DIR, "static", "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)

FFMPEG = get_ffmpeg_exe()

# Voice yang tersedia (3 pilihan sesuai keputusan user).
VOICES = [
    {"id": "id-ID-ArdiNeural", "name": "Ardi", "gender": "Male", "locale": "id-ID"},
    {"id": "id-ID-GadisNeural", "name": "Gadis", "gender": "Female", "locale": "id-ID"},
    {"id": "en-US-JennyNeural", "name": "Jenny", "gender": "Female", "locale": "en-US"},
]


def list_voices():
    return VOICES


def _split_text(text, max_chars=800):
    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks = []
    cur = ""
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        if len(cur) + len(s) + 1 <= max_chars:
            cur = (cur + " " + s).strip()
        else:
            if cur:
                chunks.append(cur)
            if len(s) > max_chars:
                for i in range(0, len(s), max_chars):
                    chunks.append(s[i : i + max_chars])
                cur = ""
            else:
                cur = s
    if cur:
        chunks.append(cur)
    return [c for c in chunks if c.strip()]


def _resolve_path(fp: str) -> str:
    """Cari path file yang valid, termasuk fallback migrasi Windows->Linux.

    DB lama menyimpan filepath absolut Windows (C:\\Users\\...). Di Linux
    file itu tidak ada, tapi salinannya ada di storage/uploads/<basename>.
    Mirip logika di routers/materials.py & storage_cleanup_service.py.
    """
    if not fp:
        return fp
    if os.path.exists(fp):
        return fp
    candidates = []
    # 1. storage/uploads/<basename> (handle separator Windows)
    cand = os.path.join(config.UPLOADS_DIR, os.path.basename(fp.replace("\\", "/")))
    if os.path.exists(cand):
        return cand
    # 2. relative terhadap BASE_DIR
    if not os.path.isabs(fp):
        cand2 = os.path.join(config.BASE_DIR, fp)
        if os.path.exists(cand2):
            return cand2
    candidates.append(cand)
    return candidates[0] if candidates else fp


def generate_audio(db, material_id, voice):
    """Buat record baru lalu jalankan generate di background thread."""
    material = db.query(models.Material).get(material_id)
    if not material:
        raise ValueError("Materi tidak ditemukan")
    if voice not in [v["id"] for v in VOICES]:
        raise ValueError("Voice tidak valid")

    filepath = _resolve_path(material.filepath)
    if not filepath or not os.path.exists(filepath):
        raise ValueError(
            "File materi tidak ditemukan di storage. Coba upload ulang materi tersebut."
        )

    text = extract_text(filepath).strip()
    if not text:
        raise ValueError(
            "Dokumen tidak mengandung teks yang dapat dibaca "
            "(mungkin hasil scan gambar). Upload versi PDF teks atau gunakan OCR."
        )
    if text.lower().startswith("error"):
        raise ValueError(f"Gagal membaca file: {text[:200]}")

    # Simpan path yang sudah ter-resolve agar generate berikutnya langsung valid.
    if filepath != material.filepath:
        material.filepath = filepath
        db.commit()

    rec = AudioGeneration(
        material_id=material.id,
        subject_id=material.subject_id,
        voice=voice,
        status="Processing",
        progress=0,
        stage="Mempersiapkan...",
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    file_path = os.path.join(AUDIO_DIR, f"{uuid.uuid4().hex}.mp3")
    rec.file_path = file_path
    db.commit()

    _cancel_flags[rec.id] = threading.Event()
    threading.Thread(
        target=_run, args=(rec.id, text, voice, file_path), daemon=True
    ).start()
    return rec


_cancel_flags = {}


def recover_stale_audio(db=None):
    """Tandai audio \"Processing\" sebagai gagal setelah server restart.

    Thread TTS tidak bertahan melewati restart. Tanpa recovery, record lama
    tetap Processing selamanya dan frontend terus polling (banner job macet).
    """
    own_db = db is None
    if own_db:
        db = SessionLocal()
    try:
        stale = (
            db.query(AudioGeneration)
            .filter(AudioGeneration.status == "Processing")
            .all()
        )
        for rec in stale:
            rec.status = "Failed"
            rec.stage = "Gagal"
            rec.error = (
                "Proses terhenti karena server dimulai ulang. "
                "Silakan generate ulang audio."
            )
        if stale:
            db.commit()
        return len(stale)
    finally:
        if own_db:
            db.close()


def _run(rec_id, text, voice, file_path):
    db = SessionLocal()
    try:
        rec = db.query(AudioGeneration).get(rec_id)
        if not rec:
            return
        chunks = _split_text(text)
        total = len(chunks)
        tmp_files = []
        for i, chunk in enumerate(chunks):
            if _cancel_flags.get(rec_id) and _cancel_flags[rec_id].is_set():
                rec.status = "Cancelled"
                rec.stage = "Dibatalkan"
                db.commit()
                return
            tmp = os.path.join(tempfile.gettempdir(), f"audio_{rec_id}_{i}.mp3")
            try:
                asyncio.run(_speak(chunk, voice, tmp))
            except Exception:
                # chunk gagal -> lanjut chunk berikutnya agar tidak hang
                continue
            if os.path.exists(tmp) and os.path.getsize(tmp) > 0:
                tmp_files.append(tmp)
            rec.progress = int((i + 1) / total * 100)
            rec.stage = f"Generating audio {i + 1}/{total}"
            db.commit()

        if not tmp_files:
            rec.status = "Failed"
            rec.error = "Gagal menghasilkan audio (tidak ada potongan yang berhasil)."
            rec.stage = "Gagal"
            db.commit()
            return

        rec.stage = "Menggabungkan audio..."
        db.commit()
        _concat(tmp_files, file_path)
        for tf in tmp_files:
            try:
                os.remove(tf)
            except Exception:
                pass

        rec.status = "Ready"
        rec.progress = 100
        rec.stage = "Selesai"
        rec.duration_sec = _duration_sec(file_path)
        db.commit()
    except Exception as e:
        rec = db.query(AudioGeneration).get(rec_id)
        if rec:
            rec.status = "Failed"
            rec.error = str(e)[:500]
            rec.stage = "Gagal"
            db.commit()
    finally:
        _cancel_flags.pop(rec_id, None)
        db.close()


async def _speak(text, voice, out_path):
    communicate = edge_tts.Communicate(text, voice)
    with open(out_path, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])


def _concat(paths, out):
    listfile = os.path.join(tempfile.gettempdir(), "audio_concat_list.txt")
    with open(listfile, "w") as f:
        for p in paths:
            f.write(f"file '{p}'\n")
    subprocess.run(
        [FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", listfile, "-c", "copy", out],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def _duration_sec(path):
    try:
        out = subprocess.run(
            [FFMPEG, "-i", path, "-f", "null", "-"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        ).stderr.decode("utf-8", "ignore")
        m = re.search(r"Duration: (\d+):(\d+):(\d+)", out)
        if m:
            h, mi, s = map(int, m.groups())
            return h * 3600 + mi * 60 + s
    except Exception:
        pass
    return None


def get_list(db, subject_id=None, material_id=None):
    q = db.query(AudioGeneration)
    if subject_id is not None:
        q = q.filter(AudioGeneration.subject_id == subject_id)
    if material_id is not None:
        q = q.filter(AudioGeneration.material_id == material_id)
    rows = q.order_by(AudioGeneration.created_at.desc()).all()
    return rows


def get_status(db, audio_id):
    return db.query(AudioGeneration).get(audio_id)


def cancel(db, audio_id):
    rec = db.query(AudioGeneration).get(audio_id)
    if not rec:
        return None
    if rec.status in ("Ready", "Failed", "Cancelled"):
        return rec
    flag = _cancel_flags.get(audio_id)
    if flag:
        flag.set()
    rec.status = "Cancelled"
    rec.stage = "Dibatalkan"
    db.commit()
    db.refresh(rec)
    return rec


def remove(db, audio_id):
    rec = db.query(AudioGeneration).get(audio_id)
    if not rec:
        return False
    if rec.file_path and os.path.exists(rec.file_path):
        try:
            os.remove(rec.file_path)
        except Exception:
            pass
    flag = _cancel_flags.get(audio_id)
    if flag:
        flag.set()
    db.delete(rec)
    db.commit()
    return True
