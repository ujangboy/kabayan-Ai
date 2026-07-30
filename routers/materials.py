from fastapi import APIRouter, Depends, UploadFile, File, Form, BackgroundTasks, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import get_db
import models
from services.material_service import material_service
from services.audio_service import audio_service
from repositories.material_repository import material_repository

router = APIRouter()

@router.get("/api/materials")
async def get_materials_json(db: Session = Depends(get_db), skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200)):
    materials = material_repository.get_all(db, skip=skip, limit=limit)
    results = []
    for m in materials:
        results.append({
            "id": m.id,
            "filename": m.filename,
            "material_type": m.material_type,
            "status": m.status,
            "failure_reason": m.failure_reason,
            "upload_date": m.upload_date.isoformat() if m.upload_date else None,
            "subject": {"id": m.subject.id, "name": m.subject.name} if m.subject else None
        })
    return JSONResponse({"materials": results, "skip": skip, "limit": limit})

@router.post("/api/materials")
async def upload_material(
    background_tasks: BackgroundTasks,
    subject_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        # REQ-01: Validasi ukuran (max 50MB)
        MAX_SIZE = 50 * 1024 * 1024
        file_bytes = await file.read()
        if len(file_bytes) > MAX_SIZE:
            return JSONResponse(status_code=400, content={"status": "error", "message": f"Ukuran file melebihi batas 50MB. Ukuran file: {len(file_bytes) // (1024*1024)}MB"})
        await file.seek(0)

        # REQ-01: Validasi ekstensi file
        filename_lower = (file.filename or "").lower()
        ALLOWED_EXTENSIONS = (".pdf", ".docx", ".doc", ".txt", ".md", ".pptx", ".xlsx")
        if not any(filename_lower.endswith(ext) for ext in ALLOWED_EXTENSIONS):
            return JSONResponse(status_code=400, content={"status": "error", "message": f"Format file tidak didukung. Gunakan: PDF, DOCX, TXT, MD, PPTX, XLSX"})

        # REQ-01: Validasi magic bytes — cegah file palsu (rename ekstensi)
        MAGIC_BYTES = {
            ".pdf":  [b"%PDF"],
            ".docx": [b"PK\x03\x04"],  # ZIP header (OOXML)
            ".pptx": [b"PK\x03\x04"],
            ".xlsx": [b"PK\x03\x04"],
            ".txt":  None,  # teks plain, tidak ada magic bytes spesifik
            ".md":   None,
            ".doc":  [b"\xd0\xcf\x11\xe0"],  # OLE2 compound
        }
        ext = next((e for e in ALLOWED_EXTENSIONS if filename_lower.endswith(e)), None)
        magic_list = MAGIC_BYTES.get(ext)
        if magic_list:
            if not any(file_bytes[:8].startswith(m) for m in magic_list):
                return JSONResponse(status_code=400, content={"status": "error", "message": f"File '{file.filename}' tampaknya rusak atau ekstensinya dipalsukan."})
        await file.seek(0)

        filepath, mat_id = material_service.upload_material_sync(db, subject_id, file)
        return JSONResponse({"status": "success", "message": "Material uploaded, waiting for processing"})
    finally:
        await file.close()

@router.post("/api/materials/{material_id}/delete")
async def delete_material(material_id: int, db: Session = Depends(get_db)):
    material_service.delete(db, material_id)
    return JSONResponse({"status": "success", "message": "Material deleted"})

@router.post("/api/materials/{material_id}/audio")
async def generate_audio(material_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Trigger audio generation in background
    background_tasks.add_task(audio_service.generate_audio_for_material_async, material_id)
    return JSONResponse({"status": "processing", "message": "Audio generating"})

@router.get("/api/materials/{material_id}/audio")
async def get_audio_status(material_id: int, db: Session = Depends(get_db)):
    audio_gen = audio_service.get_audio_status(db, material_id)
    if not audio_gen:
        return JSONResponse({"status": "none", "filepath": None})
    return JSONResponse({
        "status": audio_gen.status,
        "filepath": audio_gen.filepath,
        "engine_used": audio_gen.engine_used,
        "updated_at": audio_gen.created_at.isoformat() if audio_gen.created_at else None
    })

