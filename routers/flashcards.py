from fastapi import APIRouter, Depends, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from repositories.flashcard_repository import flashcard_repository
from services.flashcard_service import flashcard_service
from services.material_service import material_service
from services.rag_service import rag_service

router = APIRouter()

@router.get("/api/flashcards")
async def get_flashcards_json(db: Session = Depends(get_db)):
    flashcards = flashcard_repository.get_all(db)
    results = []
    for f in flashcards:
        results.append({
            "id": f.id,
            "question": f.question,
            "answer": f.answer,
            "created_at": f.created_at.isoformat() if f.created_at else None,
            "subject": {"id": f.subject.id, "name": f.subject.name} if f.subject else None
        })
    return JSONResponse({"flashcards": results})

@router.post("/api/flashcards")
async def create_flashcard(
    question: str = Form(...),
    answer: str = Form(...),
    subject_id: int = Form(...),
    db: Session = Depends(get_db)
):
    flashcard_repository.create(db, {
        "question": question,
        "answer": answer,
        "subject_id": subject_id
    })
    return JSONResponse({"status": "success", "message": "Flashcard created"})

@router.post("/api/flashcards/{flashcard_id}/delete")
async def delete_flashcard(flashcard_id: int, db: Session = Depends(get_db)):
    flashcard_repository.delete(db, flashcard_id)
    return JSONResponse({"status": "success", "message": "Flashcard deleted"})

@router.post("/api/flashcards/clear")
async def clear_flashcards(db: Session = Depends(get_db)):
    flashcard_repository.delete_all(db)
    return JSONResponse({"status": "success", "message": "Flashcards cleared"})


@router.post("/api/flashcards/generate")
async def generate_flashcards(
    subject_id: int = Form(...),
    count: int = Form(10),
    db: Session = Depends(get_db)
):
    """Generate flashcards dari materi subject menggunakan AI + RAG."""
    try:
        materials = material_service.get_by_subject(db, subject_id)
        if not materials:
            return JSONResponse(
                status_code=400,
                content={"detail": "Tidak ada materi untuk mata kuliah ini. Upload materi terlebih dahulu."}
            )

        doc_ids = [f"mat_{m.id}" for m in materials]

        # Strategi 1: Ambil dari FAISS chunk_metadata (jika sudah di-index)
        context = ""
        word_count = 0
        for meta in rag_service.chunk_metadata:
            if meta["doc_id"] in doc_ids:
                context += meta["content"] + "\n\n"
                word_count += len(meta["content"].split())
                if word_count > 1500:
                    break

        # Strategi 2 (fallback): Baca langsung dari file jika context kosong
        if not context:
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
            return JSONResponse(
                status_code=400,
                content={"detail": "Tidak ada konten materi yang dapat dibaca. Pastikan file PDF dapat diproses."}
            )

        generated_count = flashcard_service.generate_flashcards(db, subject_id, context)
        return JSONResponse({
            "status": "success",
            "count": generated_count,
            "message": f"{generated_count} flashcard berhasil dibuat oleh AI."
        })
    except ValueError as e:
        return JSONResponse(status_code=422, content={"detail": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

