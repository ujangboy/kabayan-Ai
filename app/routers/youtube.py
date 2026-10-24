from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Material, MaterialType
from app.exceptions import AppError
from app.repositories.material_repository import material_repository
from app.services.youtube_service import youtube_service
from app.sources.youtube_source import YoutubeSource
import re
from app.schemas.common import StatusMessage

router = APIRouter()

class YoutubeImportRequest(BaseModel):
    url: str
    subject_id: int

@router.post("/api/materials/youtube", response_model=dict)
async def import_youtube(request: YoutubeImportRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        source = YoutubeSource(request.url)
        video_id = source.video_id
    except ValueError as e:
        return JSONResponse(status_code=400, content={"detail": str(e)})

    # Duplicate check global — video yang sama ditolak di semua mata kuliah (hindari kerja ganda).
    # Materi berstatus Trashed tidak dihitung: video di sampah boleh di-import ulang.
    from app.models import YoutubeMetadata
    existing = db.query(Material).filter(
        Material.material_type == MaterialType.YOUTUBE,
        Material.external_id == video_id,
        Material.status != "Trashed"
    ).first()

    if existing:
        subject_name = existing.subject.name if existing.subject else "?"
        return JSONResponse(status_code=409, content={"detail": f"Video ini sudah diimpor (di mata kuliah '{subject_name}')."})

    # Basic meta for UI immediately
    meta = source.get_metadata()
    title = meta.get("title", f"YouTube Video {video_id}")

    mat = material_repository.create(db, {
        "subject_id": request.subject_id,
        "filename": title,
        "filepath": "",
        "material_type": MaterialType.YOUTUBE,
        "source_url": request.url,
        "external_id": video_id,
        "thumbnail": meta.get("thumbnail_url"),
        "status": "Pending"
    })

    # PENTING: commit SEBELUM background task dijalankan.
    # create() hanya flush; tanpa commit, task (session baru) tidak akan
    # melihat material ini karena transaksi request belum di-commit
    # (teardown dependency berjalan SETELAH background task selesai).
    try:
        db.commit()
    except IntegrityError:
        # Race: dua import paralel video yang sama — unique index
        # (material_type, external_id) menolak yang kedua.
        db.rollback()
        raise AppError("Video ini sudah diimpor.", status_code=409)

    background_tasks.add_task(youtube_service.process_youtube_async, mat.id, request.url)

    return {"status": "processing", "material_id": mat.id, "message": "Video sedang diproses di background."}

@router.get("/api/materials/youtube/status/{id}", response_model=dict)
async def get_youtube_status(id: int, db: Session = Depends(get_db)):
    mat = material_repository.get(db, id)
    if not mat:
        raise HTTPException(status_code=404, detail="Material not found")
    return {"status": mat.status}

@router.delete("/api/materials/youtube/{id}", response_model=StatusMessage)
async def delete_youtube(id: int, db: Session = Depends(get_db)):
    success = youtube_service.delete_youtube(db, id)
    if not success:
        raise HTTPException(status_code=404, detail="Material not found or deletion failed")
    return {"status": "success"}
