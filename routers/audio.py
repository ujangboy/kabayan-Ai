"""Router audio TTS — generate & kelola audio dari materi."""
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import get_db

from services import audio_service
from models import AudioGeneration

router = APIRouter(prefix="/api/audio", tags=["audio"])


@router.get("/voices")
async def list_voices():
    return {"voices": audio_service.list_voices()}


@router.post("/generate")
async def generate_audio(payload: dict, db: Session = Depends(get_db)):
    try:
        material_id = payload.get("material_id")
        voice = payload.get("voice")
        if not material_id:
            raise HTTPException(status_code=400, detail="material_id wajib diisi.")
        if not voice:
            raise HTTPException(status_code=400, detail="voice wajib dipilih.")
        rec = audio_service.generate_audio(db, int(material_id), voice)
        return _serialize(rec)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        from services.error_handler import safe_json_response
        return safe_json_response(e, context="audio/generate")


@router.get("")
async def list_audio(
    subject_id: int = Query(None),
    material_id: int = Query(None),
    db: Session = Depends(get_db),
):
    try:
        rows = audio_service.get_list(
            db, subject_id=subject_id, material_id=material_id
        )
        return {"audio": [_serialize(r) for r in rows]}
    except Exception as e:
        from services.error_handler import safe_json_response
        return safe_json_response(e, context="audio/list")


@router.get("/{audio_id}/status")
async def audio_status(audio_id: int, db: Session = Depends(get_db)):
    try:
        rec = audio_service.get_status(db, audio_id)
        if not rec:
            raise HTTPException(status_code=404, detail="Audio tidak ditemukan.")
        return _serialize(rec)
    except HTTPException:
        raise
    except Exception as e:
        from services.error_handler import safe_json_response
        return safe_json_response(e, context="audio/status")


@router.post("/{audio_id}/cancel")
async def cancel_audio(audio_id: int, db: Session = Depends(get_db)):
    try:
        rec = audio_service.cancel(db, audio_id)
        if not rec:
            raise HTTPException(status_code=404, detail="Audio tidak ditemukan.")
        return _serialize(rec)
    except HTTPException:
        raise
    except Exception as e:
        from services.error_handler import safe_json_response
        return safe_json_response(e, context="audio/cancel")


@router.delete("/{audio_id}")
async def delete_audio(audio_id: int, db: Session = Depends(get_db)):
    try:
        ok = audio_service.remove(db, audio_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Audio tidak ditemukan.")
        return {"status": "success", "deleted": audio_id}
    except HTTPException:
        raise
    except Exception as e:
        from services.error_handler import safe_json_response
        return safe_json_response(e, context="audio/delete")


@router.get("/{audio_id}/file")
async def audio_file(audio_id: int, db: Session = Depends(get_db)):
    try:
        rec = audio_service.get_status(db, audio_id)
        if not rec or not rec.file_path or not __import__("os").path.exists(rec.file_path):
            raise HTTPException(status_code=404, detail="File audio tidak tersedia.")
        return FileResponse(rec.file_path, media_type="audio/mpeg", filename=f"audio-{audio_id}.mp3")
    except HTTPException:
        raise
    except Exception as e:
        from services.error_handler import safe_json_response
        return safe_json_response(e, context="audio/file")


def _serialize(rec: AudioGeneration):
    return {
        "id": rec.id,
        "material_id": rec.material_id,
        "subject_id": rec.subject_id,
        "voice": rec.voice,
        "status": rec.status,
        "progress": rec.progress,
        "stage": rec.stage,
        "duration_sec": rec.duration_sec,
        "error": rec.error,
        "file_url": f"/api/audio/{rec.id}/file" if rec.status == "Ready" else None,
        "created_at": rec.created_at.isoformat() if rec.created_at else None,
    }
