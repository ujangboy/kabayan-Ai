from fastapi import APIRouter, Request, Depends, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from database import get_db
from services.subject_service import subject_service

router = APIRouter()
templates = Jinja2Templates(directory="templates")

@router.get("/subjects", response_class=HTMLResponse)
async def get_subjects(request: Request, db: Session = Depends(get_db)):
    subjects = subject_service.get_all(db)
    return templates.TemplateResponse(
        request=request,
        name="subjects.html",
        context={
            "active_page": "subjects",
            "subjects": subjects
        }
    )

from fastapi.responses import JSONResponse
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

@router.get("/subjects/{subject_id}", response_class=HTMLResponse)
async def get_subject_detail(subject_id: int, request: Request, db: Session = Depends(get_db)):
    subject = subject_service.get_by_id(db, subject_id)
    if not subject:
        return RedirectResponse(url="/subjects", status_code=303)
    return templates.TemplateResponse(
        request=request,
        name="subject_detail.html",
        context={
            "active_page": "subjects",
            "subject": subject
        }
    )

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
