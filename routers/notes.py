from fastapi import APIRouter, Depends, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from database import get_db
from services.notes_service import notes_service

router = APIRouter()

@router.get("/api/notes")
async def get_notes_json(db: Session = Depends(get_db)):
    notes = notes_service.get_all(db)
    results = []
    for n in notes:
        results.append({
            "id": n.id,
            "title": n.title,
            "content": n.content,
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "subject": {"id": n.subject.id, "name": n.subject.name} if n.subject else None
        })
    return JSONResponse({"notes": results})

@router.post("/api/notes")
async def create_note(
    title: str = Form(...),
    content: str = Form(...),
    subject_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    from repositories.note_repository import note_repository
    note_repository.create(db, {
        "title": title,
        "content": content,
        "subject_id": subject_id if subject_id else None
    })
    return JSONResponse({"status": "success", "message": "Note created"})

@router.post("/api/notes/{note_id}/delete")
async def delete_note(note_id: int, db: Session = Depends(get_db)):
    notes_service.delete(db, note_id)
    return JSONResponse({"status": "success", "message": "Note deleted"})

@router.post("/api/notes/{note_id}/action")
async def note_action(note_id: int, action: str = Form(...), db: Session = Depends(get_db)):
    success, updated_content = notes_service.process_action(db, note_id, action)
    if not success:
        return JSONResponse(status_code=404, content={"status": "error", "message": "Note not found"})
    return JSONResponse({"status": "success", "content": updated_content})

@router.post("/api/notes/clear")
async def clear_notes(db: Session = Depends(get_db)):
    from repositories.note_repository import note_repository
    note_repository.delete_all(db)
    return JSONResponse({"status": "success", "message": "Notes cleared"})

# REQ-PRD: Endpoint Direct-to-Notebook dari tombol chat
class NotebookGenerateRequest(BaseModel):
    title: str
    content: str

@router.post("/api/notebook/generate")
async def notebook_generate(request: NotebookGenerateRequest, db: Session = Depends(get_db)):
    """Simpan teks dari input chat langsung ke notebook tanpa memanggil Groq AI."""
    from repositories.note_repository import note_repository
    if not request.content.strip():
        return JSONResponse(status_code=400, content={"status": "error", "message": "Konten tidak boleh kosong"})
    title = request.title.strip() or request.content[:30].strip()
    note_repository.create(db, {
        "title": title,
        "content": request.content,
        "subject_id": None
    })
    return JSONResponse({"status": "success", "message": "Catatan berhasil disimpan ke Notebook!"})
