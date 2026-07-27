from fastapi import APIRouter, Depends, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from services.subject_service import subject_service

router = APIRouter()

@router.get("/api/subjects")
async def get_subjects_json(db: Session = Depends(get_db)):
    subjects = subject_service.get_all(db)
    results = []
    for s in subjects:
        results.append({
            "id": s.id,
            "name": s.name,
            "semester": s.semester,
            "lecturer": s.lecturer,
            "description": s.description
        })
    return JSONResponse({"subjects": results})

@router.get("/api/subjects/{subject_id}")
async def get_subject_by_id(subject_id: int, db: Session = Depends(get_db)):
    subject = subject_service.get_by_id(db, subject_id)
    if not subject:
        return JSONResponse(status_code=404, content={"detail": "Subject not found"})

    materials = [
        {
            "id": m.id,
            "filename": m.filename,
            "material_type": m.material_type,
            "status": m.status,
            "upload_date": m.upload_date.isoformat() if m.upload_date else None,
            "subject": {"id": subject.id, "name": subject.name}
        }
        for m in subject.materials
    ]
    return JSONResponse({"subject": {"id": subject.id, "name": subject.name, "semester": subject.semester, "lecturer": subject.lecturer, "description": subject.description, "materials": materials}})

@router.post("/api/subjects")
async def create_subject(
    name: str = Form(...),
    semester: str = Form(""),
    lecturer: str = Form(""),
    description: str = Form(""),
    db: Session = Depends(get_db)
):
    subject_service.create(db, name, semester, lecturer, description)
    return JSONResponse({"status": "success", "message": "Subject created"})

@router.post("/api/subjects/{subject_id}/delete")
async def delete_subject(subject_id: int, db: Session = Depends(get_db)):
    subject_service.delete(db, subject_id)
    return JSONResponse({"status": "success", "message": "Subject deleted"})
