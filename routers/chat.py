from fastapi import APIRouter, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from database import get_db
from services.chat_service import chat_service
from services.notes_service import notes_service
from services.flashcard_service import flashcard_service
from services.quiz_service import quiz_service
from exceptions import AppError
import time

router = APIRouter()

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[Message] = []
    documents: List[str] = []


@router.post("/api/chat")
async def chat_endpoint(request: ChatRequest, db: Session = Depends(get_db)):
    import asyncio
    import os
    from fastapi.responses import StreamingResponse
    try:
        from services.ai_service import ai_service
        from services.rag_service import rag_service

        limited_history = request.history[-6:]
        hist_dicts = [{"role": msg.role, "content": msg.content} for msg in limited_history]

        context = ""
        if request.documents:
            retrieved = await asyncio.to_thread(rag_service.search, request.message, request.documents, 5)
            if retrieved:
                context = "--- DOKUMEN REFERENSI LOKAL ---\n" + retrieved + "\n\n"

            if not context:
                from repositories.material_repository import material_repository
                from parsers.document_parser import extract_text

                mat_ids = []
                for doc_id in request.documents:
                    if doc_id.startswith("mat_"):
                        try:
                            mat_ids.append(int(doc_id[4:]))
                        except ValueError:
                            pass

                fallback_texts = []
                word_total = 0
                for mid in mat_ids:
                    mat = material_repository.get(db, mid)
                    if mat and mat.filepath and os.path.exists(mat.filepath):
                        try:
                            text = extract_text(mat.filepath)
                            if text:
                                words = text.split()
                                chunk = " ".join(words[:1500])
                                fallback_texts.append(chunk)
                                word_total += min(len(words), 1500)
                        except Exception:
                            pass
                    if word_total >= 3000:
                        break

                if fallback_texts:
                    context = "--- DOKUMEN REFERENSI LOKAL ---\n" + "\n\n---\n\n".join(fallback_texts) + "\n\n"

        if context:
            max_chars = 24000
            history_chars = sum(len(m.content) for m in limited_history)
            available = max_chars - history_chars - len(request.message)
            if available > 0 and len(context) > available:
                context = context[:available] + "\n\n[Context terpotong untuk menghemat memori]"
            elif available <= 0:
                context = ""

        return StreamingResponse(ai_service.achat_stream(hist_dicts, context, request.message), media_type="text/plain")
    except ValueError as e:
        raise AppError(str(e), status_code=400)
    except Exception as e:
        raise AppError(str(e), status_code=500)

class ExportRequest(BaseModel):
    content: str
    subject_id: Optional[int] = None

@router.post("/api/export/note")
async def export_note(request: ExportRequest, db: Session = Depends(get_db)):
    try:
        title = request.content[:30] + "..." if len(request.content) > 30 else request.content
        from repositories.note_repository import note_repository
        note_repository.create(db, {
            "title": f"Chat Export: {title}",
            "content": request.content,
            "subject_id": None
        })
        return {"status": "success", "message": "Disimpan ke Catatan"}
    except Exception as e:
        raise AppError(str(e), status_code=500)

@router.post("/api/export/flashcards")
async def export_flashcards(request: ExportRequest, db: Session = Depends(get_db)):
    try:
        count = flashcard_service.generate_flashcards(db, request.subject_id, request.content)
        return {"status": "success", "message": f"{count} Flashcard berhasil dibuat"}
    except Exception as e:
        raise AppError(f"Gagal mengekstrak flashcard: {str(e)}", status_code=500)

@router.post("/api/export/quiz")
async def export_quiz(request: ExportRequest, db: Session = Depends(get_db)):
    try:
        return {"status": "success", "message": "Fitur kuis telah ditingkatkan menjadi interaktif. Silakan buka menu Quiz di sidebar untuk menggenerate kuis secara dinamis dari materi Anda!"}
    except Exception as e:
        raise AppError(str(e), status_code=500)