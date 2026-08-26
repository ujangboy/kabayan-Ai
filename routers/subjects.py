from fastapi import APIRouter, Depends, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from services.subject_service import subject_service, compute_subject_stats
import json

router = APIRouter()


def _subject_basic(s, stats):
    return {
        "id": s.id,
        "name": s.name,
        "semester": s.semester,
        "lecturer": s.lecturer,
        "description": s.description,
        "created_at": s.created_at.isoformat() if getattr(s, 'created_at', None) else None,
        **stats,
    }


@router.get("/api/subjects")
async def get_subjects_json(db: Session = Depends(get_db)):
    subjects = subject_service.get_all(db)
    results = []
    for s in subjects:
        stats = compute_subject_stats(db, s)
        results.append(_subject_basic(s, stats))
    return JSONResponse({"subjects": results})


@router.get("/api/subjects/{subject_id}")
async def get_subject_by_id(subject_id: int, db: Session = Depends(get_db)):
    subject = subject_service.get_by_id(db, subject_id)
    if not subject:
        return JSONResponse(status_code=404, content={"detail": "Subject not found"})

    stats = compute_subject_stats(db, subject)
    materials = [
        {
            "id": m.id,
            "filename": m.filename,
            "material_type": m.material_type,
            "status": m.status,
            "upload_date": m.upload_date.isoformat() if m.upload_date else None,
            "subject": {"id": subject.id, "name": subject.name}
        }
        for m in subject.materials
    ]
    return JSONResponse({"subject": {**_subject_basic(subject, stats), "materials": materials}})


@router.get("/api/subjects/{subject_id}/dashboard")
async def get_subject_dashboard(subject_id: int, db: Session = Depends(get_db)):
    """Dashboard lengkap untuk satu mata kuliah: stats, progress topik, riwayat skor,
    aktivitas terbaru, dan rencana belajar aktif."""
    from models import Quiz, ExamSession, Flashcard, Material, StudyPlan

    subject = subject_service.recalculate_subject_stats(db, subject_id)
    if not subject:
        return JSONResponse(status_code=404, content={"detail": "Subject not found"})

    # ─── Topic progress dari weak/strong topics semua sesi ujian ───
    # Hanya 2 kolom JSON yang dibutuhkan — jangan load entity penuh.
    session_topics = (
        db.query(ExamSession.strong_topics_json, ExamSession.weak_topics_json)
        .filter(ExamSession.subject_id == subject_id)
        .all()
    )
    topic_map: dict = {}  # topic -> {"accuracy_sum": int, "samples": int, "weak": int, "strong": int}

    def _acc(item):
        if isinstance(item, dict):
            return item.get("accuracy") or item.get("score") or 0
        return 0

    for strong_raw, weak_raw in session_topics:
        for key, raw in (("strong_topics_json", strong_raw), ("weak_topics_json", weak_raw)):
            try:
                parsed = json.loads(raw) if raw else []
            except Exception:
                parsed = []
            if not isinstance(parsed, list):
                continue
            is_strong = key == "strong_topics_json"
            for item in parsed:
                topic = item.get("topic", "Umum") if isinstance(item, dict) else str(item)
                entry = topic_map.setdefault(topic, {"accuracy_sum": 0, "samples": 0, "weak": 0, "strong": 0})
                entry["accuracy_sum"] += _acc(item)
                entry["samples"] += 1
                entry["strong" if is_strong else "weak"] += 1

    topic_progress = []
    for topic, e in topic_map.items():
        acc = round(e["accuracy_sum"] / e["samples"]) if e["samples"] else 0
        if acc >= 70:
            status = "dikuasai"
        elif acc >= 40:
            status = "berjalan"
        else:
            status = "perlu_latihan"
        topic_progress.append({
            "topic": topic,
            "accuracy": acc,
            "total_sessions": e["samples"],
            "weak_count": e["weak"],
            "strong_count": e["strong"],
            "status": status,
        })
    topic_progress.sort(key=lambda t: t["accuracy"])

    # ─── Riwayat skor (quiz + simulasi ujian) ───
    # Kolom-spesifik (tanpa entity penuh) — kolom JSON/text besar tidak diambil.
    score_history = []
    quiz_rows = (
        db.query(Quiz.created_at, Quiz.score, Quiz.title)
        .filter(Quiz.subject_id == subject_id)
        .all()
    )
    for created_at, score, title in quiz_rows:
        if score is not None:
            score_history.append({
                "date": created_at.isoformat() if created_at else None,
                "score": score,
                "label": title or "Quiz",
                "type": "quiz",
            })

    session_rows = (
        db.query(
            ExamSession.submitted_at, ExamSession.updated_at, ExamSession.started_at,
            ExamSession.best_score, ExamSession.latest_score,
            ExamSession.title, ExamSession.exam_type,
        )
        .filter(ExamSession.subject_id == subject_id)
        .all()
    )
    for submitted_at, updated_at, started_at, best, latest, title, exam_type in session_rows:
        score = best if best is not None else latest
        if score is not None:
            score_history.append({
                "date": (submitted_at or updated_at or started_at).isoformat(),
                "score": score,
                "label": title or f"Simulasi {exam_type}" if exam_type else "Simulasi",
                "type": "ujian",
            })
    score_history.sort(key=lambda x: x["date"] or "")

    # ─── Aktivitas terbaru (gabungan semua fitur) ───
    # Kolom-spesifik per sumber, lalu merge + ambil 6 terbaru.
    activity = []
    for created_at, score, title in quiz_rows:
        activity.append({"date": created_at, "type": "quiz", "label": title or "Quiz", "score": score})
    for created_at, fc_title, question in (
        db.query(Flashcard.created_at, Flashcard.title, Flashcard.question)
        .filter(Flashcard.subject_id == subject_id)
        .all()
    ):
        activity.append({"date": created_at, "type": "flashcard", "label": fc_title or (question[:40] if question else "Flashcard"), "score": None})
    for submitted_at, updated_at, started_at, best, latest, title in session_rows:
        activity.append({
            "date": submitted_at or updated_at or started_at,
            "type": "ujian",
            "label": title or "Simulasi",
            "score": best if best is not None else latest,
        })
    for upload_date, filename in (
        db.query(Material.upload_date, Material.filename)
        .filter(Material.subject_id == subject_id)
        .all()
    ):
        activity.append({"date": upload_date, "type": "materi", "label": filename, "score": None})
    activity = [a for a in activity if a["date"]]
    activity.sort(key=lambda a: a["date"], reverse=True)
    recent_activity = []
    for a in activity[:6]:
        recent_activity.append({
            "date": a["date"].isoformat(),
            "type": a["type"],
            "label": a["label"],
            "score": a["score"],
        })

    # ─── Rencana belajar aktif (dari sesi terbaru yang punya plan) ───
    # Single query join + order — bukan loop per-session (N+1).
    active_study_plan = None
    _plan_row = (
        db.query(StudyPlan, ExamSession.id.label("session_id"))
        .join(ExamSession, ExamSession.id == StudyPlan.session_id)
        .filter(ExamSession.subject_id == subject_id)
        .order_by(
            ExamSession.updated_at.isnot(None),
            ExamSession.updated_at.desc(),
            ExamSession.started_at.desc(),
        )
        .first()
    )
    if _plan_row:
        plan, plan_session_id = _plan_row
        active_study_plan = {
            "session_id": plan_session_id,
            "title": plan.title or f"Rencana Belajar — {subject.name}",
            "progress": plan.progress or 0,
            "completed_days": plan.completed_days or 0,
            "total_days": plan.total_days or 0,
            "start_date": plan.start_date.isoformat() if plan.start_date else None,
        }

    stats = compute_subject_stats(db, subject)
    materials = [
        {
            "id": m.id,
            "filename": m.filename,
            "material_type": m.material_type,
            "status": m.status,
            "upload_date": m.upload_date.isoformat() if m.upload_date else None,
        }
        for m in subject.materials
    ]
    return JSONResponse({
        "subject": {**_subject_basic(subject, stats), "materials": materials},
        "topic_progress": topic_progress,
        "score_history": score_history,
        "recent_activity": recent_activity,
        "active_study_plan": active_study_plan,
    })


@router.post("/api/subjects")
async def create_subject(
    name: str = Form(...),
    semester: str = Form(""),
    lecturer: str = Form(""),
    description: str = Form(""),
    db: Session = Depends(get_db)
):
    subject_service.create(db, name, semester, lecturer, description)
    return JSONResponse({"status": "success", "message": "Subject created"})


@router.post("/api/subjects/{subject_id}/update")
async def update_subject(
    subject_id: int,
    name: str = Form(...),
    semester: str = Form(""),
    lecturer: str = Form(""),
    description: str = Form(""),
    db: Session = Depends(get_db)
):
    subject = subject_service.update(db, subject_id, name, semester, lecturer, description)
    if not subject:
        return JSONResponse(status_code=404, content={"detail": "Subject not found"})
    return JSONResponse({"status": "success", "message": "Subject updated"})


@router.post("/api/subjects/{subject_id}/delete")
async def delete_subject(subject_id: int, db: Session = Depends(get_db)):
    if not subject_service.delete(db, subject_id):
        return JSONResponse(status_code=404, content={"detail": "Subject not found"})
    return JSONResponse({"status": "success", "message": "Subject deleted"})
