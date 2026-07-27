from fastapi import APIRouter, Depends, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from repositories.quiz_repository import quiz_repository
from services.quiz_service import quiz_service
from services.material_service import material_service
from services.rag_service import rag_service
import json

router = APIRouter()


@router.get("/api/quizzes")
async def get_quizzes_json(db: Session = Depends(get_db)):
    quizzes = quiz_repository.get_all(db)
    quizzes = sorted(quizzes, key=lambda x: x.created_at, reverse=True)
    results = []
    for q in quizzes:
        # Hitung jumlah soal dari questions_json jika ada
        question_count = 0
        if q.questions_json:
            try:
                qdata = json.loads(q.questions_json)
                question_count = len(qdata.get("mcq", []))
            except Exception:
                pass
        results.append({
            "id": q.id,
            "title": q.title,
            "score": q.score,
            "question_count": question_count,
            "created_at": q.created_at.isoformat() if q.created_at else None,
            "subject": {"id": q.subject.id, "name": q.subject.name} if q.subject else None,
        })
    return JSONResponse({"quizzes": results})


@router.get("/api/quizzes/{quiz_id}/questions")
async def get_quiz_questions(quiz_id: int, db: Session = Depends(get_db)):
    """Ambil soal-soal quiz yang tersimpan di DB untuk dimainkan."""
    quiz = quiz_repository.get(db, quiz_id)
    if not quiz:
        return JSONResponse(status_code=404, content={"detail": "Quiz tidak ditemukan."})
    if not quiz.questions_json:
        return JSONResponse(status_code=404, content={"detail": "Soal quiz belum tersedia."})
    try:
        data = json.loads(quiz.questions_json)
        return JSONResponse({
            "id": quiz.id,
            "title": quiz.title,
            "subject_id": quiz.subject_id,
            **data,
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Gagal memuat soal: {str(e)}"})


@router.post("/api/quizzes/generate")
async def generate_quiz(
    subject_id: int = Form(...),
    mcq_count: int = Form(5),
    db: Session = Depends(get_db)
):
    try:
        materials = material_service.get_by_subject(db, subject_id)
        if not materials:
            return JSONResponse(status_code=400, content={"detail": "Tidak ada materi untuk mata kuliah ini."})

        doc_ids = [f"mat_{m.id}" for m in materials]

        # Strategi 1: Ambil dari FAISS chunk_metadata (jika sudah di-index)
        context = ""
        word_count = 0
        for meta in rag_service.chunk_metadata:
            if meta["doc_id"] in doc_ids:
                context += meta["content"] + "\n\n"
                word_count += len(meta["content"].split())
                if word_count > 2000:
                    break

        # Strategi 2 (fallback): Baca langsung dari file jika context kosong
        if not context:
            from parsers.document_parser import extract_text
            for m in materials:
                if m.filepath and __import__('os').path.exists(m.filepath):
                    try:
                        text = extract_text(m.filepath)
                        if text:
                            # Ambil max 2000 kata
                            words = text.split()
                            context += " ".join(words[:2000]) + "\n\n"
                            word_count += min(len(words), 2000)
                    except Exception:
                        pass
                if word_count >= 2000:
                    break

        if not context.strip():
            return JSONResponse(status_code=400, content={"detail": "Tidak ada konten materi yang dapat dibaca. Pastikan file PDF dapat diproses."})

        # Ambil nama subject untuk judul quiz
        from services.subject_service import subject_service as svc
        subject = svc.get_by_id(db, subject_id)
        title = f"Quiz {subject.name}" if subject else f"Quiz #{subject_id}"

        data = quiz_service.generate_quiz(
            db, subject_id, context,
            mcq_count=mcq_count, essay_count=0,
            title=title
        )
        return JSONResponse(data)

    except ValueError as e:
        return JSONResponse(status_code=422, content={"detail": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})


@router.post("/api/quizzes/{quiz_id}/score")
async def save_quiz_score(
    quiz_id: int,
    score: int = Form(...),
    db: Session = Depends(get_db)
):
    """Simpan score setelah user selesai mengerjakan quiz."""
    quiz = quiz_service.save_score(db, quiz_id, score)
    if not quiz:
        return JSONResponse(status_code=404, content={"detail": "Quiz tidak ditemukan."})
    return JSONResponse({"status": "success", "quiz_id": quiz_id, "score": score})


@router.delete("/api/quizzes/{quiz_id}")
async def delete_quiz(quiz_id: int, db: Session = Depends(get_db)):
    success = quiz_repository.delete(db, quiz_id)
    if not success:
        return JSONResponse(status_code=404, content={"detail": "Quiz tidak ditemukan."})
    return JSONResponse({"status": "success"})


@router.post("/api/quizzes/clear")
async def clear_quizzes(db: Session = Depends(get_db)):
    quiz_repository.delete_all(db)
    return JSONResponse({"status": "success", "message": "Semua quiz dihapus."})


