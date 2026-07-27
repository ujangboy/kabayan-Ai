from fastapi import APIRouter, Depends, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from database import get_db
from services.notes_service import notes_service
from services.material_service import material_service
from services.rag_service import rag_service

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

@router.post("/api/notes/generate")
async def generate_notes_ai(
    subject_id: int = Form(...),
    title: str = Form(...),
    material_ids: str = Form(None),
    db: Session = Depends(get_db)
):
    """Generate catatan AI dari materi, dengan filter material opsional."""
    try:
        materials = material_service.get_by_subject(db, subject_id)
        if material_ids:
            ids = [int(x.strip()) for x in material_ids.split(",") if x.strip()]
            if ids:
                materials = [m for m in materials if m.id in ids]
        if not materials:
            return JSONResponse(status_code=400, content={"detail": "Tidak ada materi untuk mata kuliah ini."})

        doc_ids = [f"mat_{m.id}" for m in materials]
        context = ""
        word_count = 0
        for meta in rag_service.chunk_metadata:
            if meta["doc_id"] in doc_ids:
                context += meta["content"] + "\n\n"
                word_count += len(meta["content"].split())
                if word_count > 1500:
                    break

        if not context.strip():
            from parsers.document_parser import extract_text
            import os
            for m in materials:
                if m.filepath and os.path.exists(m.filepath):
                    try:
                        text = extract_text(m.filepath)
                        if text:
                            words = text.split()
                            context += " ".join(words[:1500]) + "\n\n"
                            word_count += min(len(words), 1500)
                    except Exception:
                        pass
                if word_count >= 1500:
                    break

        if not context.strip():
            return JSONResponse(status_code=400, content={"detail": "Tidak ada konten materi yang dapat dibaca."})

        note = notes_service.generate_notes(db, subject_id, title, context)
        return JSONResponse({
            "status": "success",
            "id": note.id,
            "title": note.title,
            "content": note.content
        })
    except ValueError as e:
        return JSONResponse(status_code=422, content={"detail": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

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
