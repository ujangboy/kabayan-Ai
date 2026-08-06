"""Study router — endpoint rekomendasi modalitas belajar (PRD US3.2)."""
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from database import get_db
from engines.modality_router import route as modality_route, VALID_TIERS

router = APIRouter()


class StudyRouteRequest(BaseModel):
    subject_id: int
    tier: str
    topic: Optional[str] = None


@router.post("/api/study/route")
async def study_route(req: StudyRouteRequest, db: Session = Depends(get_db)):
    """Rekomendasikan modalitas belajar berdasarkan tier kompleksitas + stok latihan."""
    from models import Subject

    subject = db.query(Subject).filter(Subject.id == req.subject_id).first()
    if not subject:
        return JSONResponse(status_code=404, content={"detail": "Mata kuliah tidak ditemukan."})

    try:
        result = modality_route(db, req.subject_id, req.tier, req.topic)
    except ValueError as e:
        return JSONResponse(status_code=422, content={"detail": str(e)})
    return JSONResponse(result)
