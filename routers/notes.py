from fastapi import APIRouter, Depends, Form, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from database import get_db
from services.notes_service import notes_service
from services.material_service import material_service
from services.rag_context_service import rag_context_service


class NotesGenerateRequest(BaseModel):
    subject_id: int
    title: Optional[str] = None
    material_ids: Optional[str] = None

router = APIRouter()

@router.get("/api/notes")
async def get_notes_json(db: Session = Depends(get_db), skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200)):
    notes = notes_service.get_all(db, skip=skip, limit=limit)
    results = []
    for n in notes:
        results.append({
            "id": n.id,
            "title": n.title,
            "content": n.content,
            "is_pinned": bool(n.is_pinned),
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "subject": {"id": n.subject.id, "name": n.subject.name} if n.subject else None
        })
    return JSONResponse({"notes": results, "skip": skip, "limit": limit})

@router.post("/api/notes")
async def create_note(
    title: str = Form(...),
    content: str = Form(""),
    subject_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    from repositories.note_repository import note_repository
    note = note_repository.create(db, {
        "title": title,
        "content": content,
        "subject_id": subject_id if subject_id else None
    })
    return JSONResponse({"status": "success", "message": "Note created", "note_id": note.id})

@router.post("/api/notes/{note_id}/delete")
async def delete_note(note_id: int, db: Session = Depends(get_db)):
    notes_service.delete(db, note_id)
    return JSONResponse({"status": "success", "message": "Note deleted"})

@router.put("/api/notes/{note_id}/rename")
async def rename_note(note_id: int, title: str = Form(...), db: Session = Depends(get_db)):
    from repositories.note_repository import note_repository
    note = note_repository.get(db, note_id)
    if not note:
        return JSONResponse(status_code=404, content={"status": "error", "message": "Note not found"})
    note_repository.update(db, note, {"title": title.strip()})
    return JSONResponse({"status": "success", "message": "Note renamed", "title": title.strip()})

@router.post("/api/notes/{note_id}/pin")
async def toggle_pin_note(note_id: int, db: Session = Depends(get_db)):
    from repositories.note_repository import note_repository
    note = note_repository.get(db, note_id)
    if not note:
        return JSONResponse(status_code=404, content={"status": "error", "message": "Note not found"})
    new_pin_state = not bool(note.is_pinned)
    note_repository.update(db, note, {"is_pinned": new_pin_state})
    return JSONResponse({"status": "success", "is_pinned": new_pin_state})

@router.patch("/api/notes/{note_id}/content")
async def update_note_content(note_id: int, db: Session = Depends(get_db), content: str = Form(...)):
    from repositories.note_repository import note_repository
    note = note_repository.get(db, note_id)
    if not note:
        return JSONResponse(status_code=404, content={"status": "error", "message": "Note not found"})
    note_repository.update(db, note, {"content": content})
    return JSONResponse({"status": "success"})

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
    req: NotesGenerateRequest,
    db: Session = Depends(get_db)
):
    try:
        # Gunakan shared utility untuk mendapatkan materi Ready
        materials = material_service.get_ready_materials(db, req.subject_id, req.material_ids)
        if not materials:
            all_materials = material_service.get_by_subject(db, req.subject_id)
            if req.material_ids:
                ids = [int(x.strip()) for x in req.material_ids.split(",") if x.strip()]
                if ids:
                    all_materials = [m for m in all_materials if m.id in ids]
            if not all_materials:
                return JSONResponse(status_code=400, content={"detail": "Tidak ada materi untuk mata kuliah ini."})
            processing = [m for m in all_materials if m.status == "Processing"]
            if processing:
                return JSONResponse(status_code=400, content={"detail": "Materi masih diproses (Processing). Tunggu beberapa saat lalu coba lagi."})
            return JSONResponse(status_code=400, content={"detail": "Tidak ada materi yang siap. Pastikan upload materi berhasil (status: Ready)."})

        query = None
        if len(materials) == 1:
            query = materials[0].filename
        context = rag_context_service.gather_context(
            materials, max_words=1500, query=query
        )

        if not context.strip():
            return JSONResponse(status_code=400, content={"detail": "Tidak ada konten materi yang dapat dibaca."})

        if not req.title or not req.title.strip():
            from services.subject_service import subject_service as svc
            subject = svc.get_by_id(db, req.subject_id)
            subject_name = subject.name if subject else f"Subject #{req.subject_id}"
            req.title = f"Catatan {subject_name}"

        # generate_notes hanya return content — TIDAK auto-save ke DB
        # Saving dilakukan oleh frontend saat user klik Simpan via POST /api/notes
        content = notes_service.generate_notes(db, req.subject_id, req.title, context)
        return JSONResponse({
            "status": "success",
            "title": req.title,
            "content": content
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
    import datetime
    if not request.content.strip():
        return JSONResponse(status_code=400, content={"status": "error", "message": "Konten tidak boleh kosong"})
    title = request.title.strip() or request.content[:30].strip()
    # Idempotency check: skip jika note dengan content yang sama ATAU title yang sama
    # sudah ada dalam 60 detik terakhir — mencegah double-save dari race condition frontend
    recent_cutoff = datetime.datetime.utcnow() - datetime.timedelta(seconds=60)
    from models import Note
    stripped_content = request.content.strip()
    stripped_title = title.strip()
    existing = db.query(Note).filter(
        Note.created_at >= recent_cutoff
    ).filter(
        (Note.content == stripped_content) | (Note.title == stripped_title)
    ).first()
    if existing:
        return JSONResponse({"status": "success", "message": "Catatan berhasil disimpan ke Notebook!"})
    note_repository.create(db, {
        "title": title,
        "content": request.content,
        "subject_id": None
    })
    return JSONResponse({"status": "success", "message": "Catatan berhasil disimpan ke Notebook!"})
