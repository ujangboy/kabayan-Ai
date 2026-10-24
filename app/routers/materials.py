from fastapi import APIRouter, Depends, UploadFile, File, Form, BackgroundTasks, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

import os
from app import config
from app.database import get_db
from app import models
from app.services.material_service import material_service
from app.repositories.material_repository import material_repository
from app.schemas.common import StatusMessage
from app.schemas.responses import MaterialList

router = APIRouter()


def _material_size_bytes(m) -> int | None:
    """Ukuran file materi dari disk (bytes). Return None jika tidak tersedia."""
    if not m.filepath:
        return None
    # Cadangan utk menangani jalur relatif maupun absolut dari storage/uploads.
    candidates = [m.filepath]
    if not os.path.isabs(m.filepath):
        candidates.append(os.path.join(config.BASE_DIR, m.filepath))
    for path in candidates:
        try:
            if os.path.isfile(path):
                return os.path.getsize(path)
        except (OSError, ValueError):
            continue
    return None

@router.get("/api/materials", response_model=MaterialList)
async def get_materials_json(
    db: Session = Depends(get_db), 
    skip: int = Query(0, ge=0), 
    limit: int = Query(50, ge=1, le=200),
    subject_id: int = Query(None)
):
    if subject_id:
        materials = material_repository.get_by_subject(db, subject_id)
    else:
        materials = material_repository.get_all(db, skip=skip, limit=limit)
    results = []
    for m in materials:
        results.append({
            "id": m.id,
            "filename": m.filename,
            "material_type": m.material_type.value if m.material_type else m.material_type,
            "status": m.status,
            "failure_reason": m.failure_reason,
            "progress": m.progress,
            "stage": m.stage,
            "upload_date": m.upload_date.isoformat() if m.upload_date else None,
            "subject_id": m.subject_id,
            "subject": {"id": m.subject.id, "name": m.subject.name} if m.subject else None,
            # Detail tambahan untuk halaman Pengaturan > Data
            "filepath": m.filepath,
            "source_url": m.source_url,
            "external_id": m.external_id,
            "thumbnail": m.thumbnail,
            "language": m.language,
            "size_bytes": _material_size_bytes(m),
        })
    return JSONResponse({"materials": results, "skip": skip, "limit": limit})

@router.post("/api/materials", response_model=dict)
async def upload_material(
    background_tasks: BackgroundTasks,
    subject_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        # Validasi subject_id eksplisit — tanpa ini FK error muncul sebagai 500
        subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
        if not subject:
            return JSONResponse(status_code=404, content={"detail": "Mata kuliah tidak ditemukan."})

        # REQ-01: Validasi ukuran awal via Content-Length (tanpa buffer file).
        # Batas final tetap ditegakkan streaming di material_service.
        MAX_SIZE = 50 * 1024 * 1024
        if getattr(file, "size", None) and file.size > MAX_SIZE:
            return JSONResponse(status_code=400, content={"detail": f"Ukuran file melebihi batas 50MB. Ukuran file: {file.size // (1024*1024)}MB"})

        # REQ-01: Validasi ekstensi file (D1: selaras dengan parsers/document_parser.py)
        filename_lower = (file.filename or "").lower()
        ALLOWED_EXTENSIONS = (".pdf", ".docx", ".txt", ".md", ".csv", ".pptx", ".xlsx")
        if not any(filename_lower.endswith(ext) for ext in ALLOWED_EXTENSIONS):
            return JSONResponse(status_code=400, content={"detail": "Format file tidak didukung. Gunakan: PDF, DOCX, TXT, MD, CSV, PPTX, XLSX"})

        # REQ-01: Validasi magic bytes dilakukan di material_service SETELAH file
        # ditulis ke disk (bukan dari stream upload) — lebih aman (stream hanya
        # dibaca sekali) dan mendukung file yang punya preamble kecil (mis. BOM).
        filepath, mat_id = material_service.upload_material_sync(db, subject_id, file)
        # ID dikembalikan agar frontend bisa langsung mendaftarkan operasi
        # pemrosesan global; tanpa ini file yang selesai cepat tidak pernah
        # memunculkan banner/toast karena polling pertama sudah melihat Ready.
        return JSONResponse({
            "status": "success",
            "message": "Material uploaded, waiting for processing",
            "material_id": mat_id,
        })
    except ValueError as e:
        # Batas 50MB ditegakkan streaming di service layer
        return JSONResponse(status_code=400, content={"detail": str(e)})
    finally:
        await file.close()

@router.post("/api/materials/{material_id}/delete", response_model=StatusMessage)
async def delete_material(material_id: int, db: Session = Depends(get_db)):
    if not material_service.delete(db, material_id):
        return JSONResponse(status_code=404, content={"detail": "Material not found"})
    return JSONResponse({"status": "success", "message": "Material deleted"})

@router.post("/api/materials/{material_id}/cancel", response_model=StatusMessage)
async def cancel_material(material_id: int, db: Session = Depends(get_db)):
    ok = material_service.cancel(db, material_id)
    if not ok:
        return JSONResponse(status_code=400, content={"detail": "Material tidak sedang diproses atau tidak ditemukan."})
    return JSONResponse({"status": "success", "message": "Material dibatalkan."})

