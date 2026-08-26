from time_utils import utcnow
from fastapi import APIRouter, Depends, Form, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from database import get_db
from services.notes_service import notes_service
from services.material_service import material_service
from services.rag_context_service import rag_context_service
from services.ai_service import ai_service
from services.subject_service import subject_service as subject_svc
from prompts.notebook import DETECT_CONTEXT_PROMPT, GENERATE_TITLE_PROMPT
from schemas.generate import (
    DetectContextRequest,
    GenerateTitleRequest,
    GenerateNoteRequest as NotesGenerateRequest,
)
import json
import re


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
    title: str = Form(..., max_length=200),
    content: str = Form("", max_length=200_000),
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
    if not notes_service.delete(db, note_id):
        return JSONResponse(status_code=404, content={"detail": "Note not found"})
    return JSONResponse({"status": "success", "message": "Note deleted"})

@router.put("/api/notes/{note_id}/rename")
async def rename_note(note_id: int, title: str = Form(..., max_length=200), db: Session = Depends(get_db)):
    from repositories.note_repository import note_repository
    note = note_repository.get(db, note_id)
    if not note:
        return JSONResponse(status_code=404, content={"detail": "Note not found"})
    note_repository.update(db, note, {"title": title.strip()})
    return JSONResponse({"status": "success", "message": "Note renamed", "title": title.strip()})

@router.post("/api/notes/{note_id}/pin")
async def toggle_pin_note(note_id: int, db: Session = Depends(get_db)):
    from repositories.note_repository import note_repository
    note = note_repository.get(db, note_id)
    if not note:
        return JSONResponse(status_code=404, content={"detail": "Note not found"})
    new_pin_state = not bool(note.is_pinned)
    note_repository.update(db, note, {"is_pinned": new_pin_state})
    return JSONResponse({"status": "success", "is_pinned": new_pin_state})

@router.patch("/api/notes/{note_id}/content")
async def update_note_content(note_id: int, db: Session = Depends(get_db), content: str = Form(...)):
    from repositories.note_repository import note_repository
    note = note_repository.get(db, note_id)
    if not note:
        return JSONResponse(status_code=404, content={"detail": "Note not found"})
    note_repository.update(db, note, {"content": content})
    return JSONResponse({"status": "success"})

@router.post("/api/notes/{note_id}/action")
async def note_action(note_id: int, action: str = Form(...), db: Session = Depends(get_db)):
    success, updated_content = notes_service.process_action(db, note_id, action)
    if not success:
        return JSONResponse(status_code=404, content={"detail": "Note not found"})
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
            materials, max_words=300, query=query
        )

        if not context.strip():
            return JSONResponse(status_code=400, content={"detail": "Tidak ada konten materi yang dapat dibaca."})

        if not req.title or not req.title.strip():
            from services.subject_service import subject_service as svc
            subject = svc.get_by_id(db, req.subject_id)
            subject_name = subject.name if subject else f"Subject #{req.subject_id}"
            req.title = f"Catatan {subject_name}"

        # generate_notes hanya return content — TIDAK auto-save ke DB
        content = notes_service.generate_notes(db, req.subject_id, req.title, context)

        # Extract title from AI-generated content (first heading)
        import re
        title = req.title
        heading_match = re.search(r'^#\s+(.+)', content, re.MULTILINE)
        if heading_match:
            title = heading_match.group(1).strip()[:80]

        return JSONResponse({
            "status": "success",
            "title": title,
            "content": content
        })
    except ValueError as e:
        from services.error_handler import safe_json_response
        return safe_json_response(e, context="notes/generate")
    except Exception as e:
        # Jangan bocorkan detail internal ke client — log penuh via safe handler
        from services.error_handler import safe_json_response
        return safe_json_response(e, context="notes/generate")

# REQ-PRD: Endpoint Direct-to-Notebook dari tombol chat
class NotebookGenerateRequest(BaseModel):
    title: str
    content: str
    subject_id: Optional[int] = None

@router.post("/api/notebook/generate")
async def notebook_generate(request: NotebookGenerateRequest, db: Session = Depends(get_db)):
    """Simpan teks dari input chat langsung ke notebook tanpa memanggil Groq AI."""
    from repositories.note_repository import note_repository
    import datetime
    if not request.content.strip():
        return JSONResponse(status_code=400, content={"detail": "Konten tidak boleh kosong"})
    title = request.title.strip() or request.content[:30].strip()
    # Idempotency check: skip jika note dengan content yang sama ATAU title yang sama
    # sudah ada dalam 60 detik terakhir — mencegah double-save dari race condition frontend
    recent_cutoff = utcnow() - datetime.timedelta(seconds=60)
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
        "subject_id": request.subject_id
    })
    return JSONResponse({"status": "success", "message": "Catatan berhasil disimpan ke Notebook!"})

@router.post("/api/notebook/detect-context")
async def detect_context(request: DetectContextRequest, db: Session = Depends(get_db)):
    """Detect mata_kuliah dan topic dari riwayat chat menggunakan AI."""
    chat_history = [m.model_dump() for m in request.history]
    if not chat_history:
        return JSONResponse({"mata_kuliah": "tidak_diketahui", "topic": "", "subject_id": None})

    # Dapatkan daftar mata kuliah dari DB
    subjects = subject_svc.get_all(db)
    subject_names = [s.name for s in subjects]
    subject_map = {s.name.lower(): s.id for s in subjects}

    # Format riwayat chat menjadi string
    history_text = "\n".join(
        f"{m.get('role', 'unknown')}: {m.get('content', '')}"
        for m in chat_history[-20:]  # maks 20 pesan terakhir
    )

    try:
        result = ai_service.generate(
            capability="summary",
            prompt_template=DETECT_CONTEXT_PROMPT,
            input_variables={"subjects": ", ".join(subject_names), "chat_history": history_text},
            use_cache=False,
            temperature=0.3,
        )
        # Parse JSON dari response AI
        clean = result.strip()
        if clean.startswith("```json"):
            clean = clean[7:]
        if clean.startswith("```"):
            clean = clean[3:]
        if clean.endswith("```"):
            clean = clean[:-3]
        parsed = json.loads(clean.strip())
        mata_kuliah = parsed.get("mata_kuliah", "tidak_diketahui")
        topic = parsed.get("topic", "")
        subject_id = None
        if mata_kuliah and mata_kuliah != "tidak_diketahui":
            # Cari subject yang cocok (case-insensitive, partial match)
            for s in subjects:
                if mata_kuliah.lower() in s.name.lower() or s.name.lower() in mata_kuliah.lower():
                    subject_id = s.id
                    break
        return JSONResponse({"mata_kuliah": mata_kuliah, "topic": topic, "subject_id": subject_id})
    except Exception as e:
        # Graceful degradation tetap 200, tapi kegagalan AI HARUS terlihat di log
        import logging
        logging.getLogger(__name__).warning(f"detect-context fallback: {e}", exc_info=True)
        return JSONResponse({"mata_kuliah": "tidak_diketahui", "topic": "", "subject_id": None})

@router.post("/api/notebook/generate-title")
async def generate_title(request: GenerateTitleRequest, db: Session = Depends(get_db)):
    """Generate judul deskriptif dari konten catatan menggunakan AI."""
    content = request.content
    if not content.strip():
        return JSONResponse({"title": "Catatan Baru"})

    try:
        snippet = content[:500]
        result = ai_service.generate(
            capability="summary",
            prompt_template=GENERATE_TITLE_PROMPT,
            input_variables={"content": snippet},
            use_cache=False,
            temperature=0.3,
        )
        title = result.strip().strip('"').strip("'")
        # Batasi max 10 kata
        words = title.split()
        if len(words) > 10:
            title = " ".join(words[:10])
        if not title:
            title = content[:30].strip()
        return JSONResponse({"title": title})
    except Exception as e:
        # Graceful degradation tetap 200, tapi kegagalan AI HARUS terlihat di log
        import logging
        logging.getLogger(__name__).warning(f"generate-title fallback: {e}", exc_info=True)
        return JSONResponse({"title": content[:30].strip()})