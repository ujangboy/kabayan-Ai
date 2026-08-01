from fastapi import APIRouter, Depends, Form, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from repositories.quiz_repository import quiz_repository
from services.quiz_service import quiz_service
from services.material_service import material_service
from services.rag_context_service import rag_context_service
import json

router = APIRouter()


@router.get("/api/quizzes")
async def get_quizzes_json(db: Session = Depends(get_db), skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200)):
    from models import Material
    quizzes = quiz_repository.get_all(db, skip=skip, limit=limit)
    quizzes = sorted(quizzes, key=lambda x: x.created_at, reverse=True)

    # Pre-load all material names needed
    all_mat_ids: set = set()
    for q in quizzes:
        if q.material_ids:
            for mid in q.material_ids.split(","):
                if mid.strip().isdigit():
                    all_mat_ids.add(int(mid.strip()))
    mat_name_map = {}
    if all_mat_ids:
        mats = db.query(Material).filter(Material.id.in_(all_mat_ids)).all()
        mat_name_map = {m.id: m.filename or f"Materi #{m.id}" for m in mats}

    results = []
    for q in quizzes:
        question_count = 0
        if q.questions_json:
            try:
                qdata = json.loads(q.questions_json)
                question_count = len(qdata.get("mcq", []))
            except Exception:
                pass
        material_names = []
        if q.material_ids:
            for mid in q.material_ids.split(","):
                if mid.strip().isdigit():
                    name = mat_name_map.get(int(mid.strip()))
                    if name:
                        material_names.append(name)
        results.append({
            "id": q.id,
            "title": q.title,
            "score": q.score,
            "question_count": question_count,
            "created_at": q.created_at.isoformat() if q.created_at else None,
            "subject": {"id": q.subject.id, "name": q.subject.name} if q.subject else None,
            "material_names": material_names,
        })
    return JSONResponse({"quizzes": results, "skip": skip, "limit": limit})


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


from schemas.generate import GenerateQuizRequest

@router.post("/api/quizzes/generate")
async def generate_quiz(
    req: GenerateQuizRequest,
    db: Session = Depends(get_db)
):
    try:
        # Gunakan hanya materi yang sudah Ready (terindeks di RAG)
        all_materials = material_service.get_by_subject(db, req.subject_id)
        if req.material_ids:
            ids = [int(x.strip()) for x in req.material_ids.split(",") if x.strip()]
            if ids:
                all_materials = [m for m in all_materials if m.id in ids]
        if not all_materials:
            return JSONResponse(status_code=400, content={"detail": "Tidak ada materi untuk mata kuliah ini."})

        materials = [m for m in all_materials if m.status == "Ready"]
        if not materials:
            processing = [m for m in all_materials if m.status == "Processing"]
            if processing:
                return JSONResponse(status_code=400, content={"detail": "Materi masih diproses (Processing). Tunggu beberapa saat lalu coba lagi."})
            return JSONResponse(status_code=400, content={"detail": "Tidak ada materi yang siap. Pastikan upload materi berhasil (status: Ready)."})

        query = None
        if len(materials) == 1:
            query = materials[0].filename
        context = rag_context_service.gather_context(
            materials, max_words=2000, query=query
        )

        if not context.strip():
            return JSONResponse(status_code=400, content={"detail": "Tidak ada konten materi yang dapat dibaca. Pastikan file PDF dapat diproses."})

        # Ambil nama subject untuk judul quiz
        from services.subject_service import subject_service as svc
        subject = svc.get_by_id(db, req.subject_id)
        title = f"Quiz {subject.name}" if subject else f"Quiz #{req.subject_id}"

        data = quiz_service.generate_quiz(
            db, req.subject_id, context,
            mcq_count=req.mcq_count, essay_count=0,
            title=title,
            material_ids=req.material_ids or None,
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


