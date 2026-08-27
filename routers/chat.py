from fastapi import APIRouter, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlalchemy.orm import Session
from database import get_db
import database
from services.flashcard_service import flashcard_service
from services.quiz_service import quiz_service
from repositories.chat_repository import chat_repository
from exceptions import AppError
import time
from schemas.common import StatusMessage

router = APIRouter()

class Message(BaseModel):
    role: str
    # Batasi panjang tiap item history agar prompt LLM tidak membengkak
    # (paritas dengan TutorChatRequest yang membatasi message 1000 char).
    content: str = Field(default="", max_length=8000)

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)
    history: List[Message] = []
    documents: List[str] = []
    session_id: Optional[str] = Field(default=None, max_length=64)


@router.post("/api/chat/{chat_id}/delete", response_model=StatusMessage)
async def delete_chat(chat_id: int, db: Session = Depends(get_db)):
    """Hapus satu chat + semua messagenya (cascade via relationship)."""
    deleted = chat_repository.delete(db, chat_id)
    if not deleted:
        return JSONResponse(status_code=404, content={"detail": "Chat not found"})
    db.commit()
    return JSONResponse({"status": "success", "message": "Chat deleted"})


@router.post("/api/chat/clear", response_model=StatusMessage)
async def clear_chats(db: Session = Depends(get_db)):
    """Hapus SEMUA chat + messagenya."""
    from models import Chat
    count = db.query(Chat).count()
    db.query(Chat).delete(synchronize_session=False)
    db.commit()
    return JSONResponse({"status": "success", "message": f"{count} chats deleted"})


@router.post("/api/chat", response_model=StatusMessage)
async def chat_endpoint(request: ChatRequest, db: Session = Depends(get_db)):
    import asyncio
    import os
    from fastapi.responses import StreamingResponse
    try:
        from services.ai_service import ai_service

        # ── Save or create chat session ─────────────────────────────
        chat_id = None
        if request.session_id:
            chat = chat_repository.get_or_create_by_uuid(db, request.session_id)
            chat_id = chat.id
            chat_repository.add_message(db, chat_id, "user", request.message)
            db.commit()

        limited_history = request.history[-8:]
        hist_dicts = [{"role": msg.role, "content": msg.content} for msg in limited_history]

        context = ""
        rag_sources = []
        if request.documents:
            from agents.retrieval_agent import retrieval_agent
            retrieval = await asyncio.to_thread(retrieval_agent.run, request.message, request.documents)
            if retrieval.context:
                context = "--- DOKUMEN REFERENSI LOKAL ---\n" + retrieval.context + "\n\n"
                rag_sources = retrieval.sources

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
                                chunk = " ".join(words[:400])
                                fallback_texts.append(chunk)
                                word_total += min(len(words), 400)
                        except Exception:
                            pass
                    if word_total >= 800:
                        break

                if fallback_texts:
                    context = "--- DOKUMEN REFERENSI LOKAL ---\n" + "\n\n---\n\n".join(fallback_texts) + "\n\n"

        if context:
            max_chars = 6000
            history_chars = sum(len(m.content) for m in limited_history)
            available = max_chars - history_chars - len(request.message)
            if available > 0 and len(context) > available:
                context = context[:available] + "\n\n[Context terpotong untuk menghemat memori]"
            elif available <= 0:
                context = ""

        # ── Stream wrapper: save assistant response after completion ─
        # Persist memakai SESSION BARU (bukan session request) agar koneksi
        # pool tidak ditahan selama durasi stream LLM — pool SQLite hanya
        # 5+15, chat paralel bisa menghabisnya. Session request ditutup
        # sebelum streaming dimulai (semua data yang dibutuhkan sudah dibaca).
        async def stream_and_persist():
            full = ""
            saved_message_id = None
            try:
                async for chunk in ai_service.achat_stream(hist_dicts, context, request.message):
                    full += chunk
                    yield chunk
            finally:
                if chat_id and full:
                    # Akses runtime via modul — bisa di-patch test ke DB uji
                    persist_db = database.SessionLocal()
                    try:
                        msg = chat_repository.add_message(persist_db, chat_id, "assistant", full)
                        persist_db.commit()
                        saved_message_id = msg.id
                    except Exception:
                        persist_db.rollback()
                    finally:
                        persist_db.close()

            # Trailing metadata: id pesan yang tersimpan agar client dapat
            # mengirim feedback (sama seperti endpoint /api/tutor/chat).
            if saved_message_id is not None:
                yield f"\x00MSGID:{saved_message_id}\x00"

        headers = {"X-Chat-Id": str(chat_id)} if chat_id else {}
        db.close()  # Lepaskan koneksi pool sebelum streaming dimulai
        return StreamingResponse(stream_and_persist(), media_type="text/plain", headers=headers)
    except ValueError as e:
        raise AppError(str(e), status_code=400)
    except Exception as e:
        raise AppError(str(e), status_code=500)

class ExportRequest(BaseModel):
    content: str
    subject_id: Optional[int] = None

@router.post("/api/export/note", response_model=StatusMessage)
async def export_note(request: ExportRequest, db: Session = Depends(get_db)):
    try:
        title = request.content[:30] + "..." if len(request.content) > 30 else request.content
        from repositories.note_repository import note_repository
        note_repository.create(db, {
            "title": f"Chat Export: {title}",
            "content": request.content,
            "subject_id": request.subject_id
        })
        return {"status": "success", "message": "Disimpan ke Catatan"}
    except Exception as e:
        raise AppError(str(e), status_code=500)

@router.post("/api/export/flashcards", response_model=StatusMessage)
async def export_flashcards(request: ExportRequest, db: Session = Depends(get_db)):
    try:
        count = flashcard_service.generate_flashcards(db, request.subject_id, request.content)
        return {"status": "success", "message": f"{count} Flashcard berhasil dibuat"}
    except Exception as e:
        raise AppError(f"Gagal mengekstrak flashcard: {str(e)}", status_code=500)

@router.post("/api/export/quiz", response_model=StatusMessage)
async def export_quiz(request: ExportRequest, db: Session = Depends(get_db)):
    try:
        return {"status": "success", "message": "Fitur kuis telah ditingkatkan menjadi interaktif. Silakan buka menu Quiz di sidebar untuk menggenerate kuis secara dinamis dari materi Anda!"}
    except Exception as e:
        raise AppError(str(e), status_code=500)