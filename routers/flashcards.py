from fastapi import APIRouter, Depends, Form, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from repositories.flashcard_repository import flashcard_repository
from services.flashcard_service import flashcard_service
from services.material_service import material_service
from services.rag_context_service import rag_context_service

router = APIRouter()

@router.get("/api/flashcards")
async def get_flashcards_json(db: Session = Depends(get_db), skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200)):
    flashcards = flashcard_repository.get_all(db, skip=skip, limit=limit)
    results = []
    for f in flashcards:
        results.append({
            "id": f.id,
            "question": f.question,
            "answer": f.answer,
            "created_at": f.created_at.isoformat() if f.created_at else None,
            "subject": {"id": f.subject.id, "name": f.subject.name} if f.subject else None
        })
    return JSONResponse({"flashcards": results, "skip": skip, "limit": limit})

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
    material_ids: str = Form(None),
    db: Session = Depends(get_db)
):
    """Generate flashcards dari materi subject menggunakan AI + RAG."""
    try:
        materials = material_service.get_by_subject(db, subject_id)
        if material_ids:
            ids = [int(x.strip()) for x in material_ids.split(",") if x.strip()]
            if ids:
                materials = [m for m in materials if m.id in ids]
        if not materials:
            return JSONResponse(
                status_code=400,
                content={"detail": "Tidak ada materi untuk mata kuliah ini. Upload materi terlebih dahulu."}
            )

        query = None
        if len(materials) == 1:
            query = materials[0].filename
        context = rag_context_service.gather_context(
            materials, max_words=1500, query=query
        )

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

