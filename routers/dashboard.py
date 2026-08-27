from fastapi import APIRouter, Request, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from services.workspace_service import workspace_service
from services.storage_cleanup_service import get_storage_usage
import models

router = APIRouter()

@router.get("/api/dashboard/stats", response_model=dict)
async def get_dashboard_stats(db: Session = Depends(get_db)):
    try:
        stats = workspace_service.get_dashboard_stats(db)

        # Recent materials (5 terbaru) — Trashed tidak ditampilkan
        recent_mats = (
            db.query(models.Material)
            .filter(models.Material.status != "Trashed")
            .order_by(models.Material.upload_date.desc())
            .limit(5)
            .all()
        )
        recent = []
        for m in recent_mats:
            recent.append({
                "id": m.id,
                "filename": m.filename,
                "material_type": m.material_type.value if m.material_type else "PDF",
                "status": m.status,
                "upload_date": m.upload_date.isoformat() if m.upload_date else None,
                "subject": {"id": m.subject.id, "name": m.subject.name} if m.subject else None,
            })

        # Recent quizzes (5 terbaru)
        recent_quizzes = (
            db.query(models.Quiz)
            .order_by(models.Quiz.created_at.desc())
            .limit(5)
            .all()
        )
        quizzes = []
        for q in recent_quizzes:
            quizzes.append({
                "id": q.id,
                "title": q.title or f"Quiz #{q.id}",
                "score": q.score,
                "created_at": q.created_at.isoformat() if q.created_at else None,
                "subject": {"id": q.subject.id, "name": q.subject.name} if q.subject else None,
            })

        return JSONResponse({
            **stats,
            # D6: observability storage (byte)
            "storage": get_storage_usage(),
            "recent_materials": recent,
            "recent_quizzes": quizzes,
        })
    except Exception as e:
        from services.error_handler import safe_json_response
        return safe_json_response(e, context="dashboard/stats")
