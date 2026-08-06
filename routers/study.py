"""
Study router — endpoint rekomendasi modalitas belajar (PRD US3.2).

POST /api/study/route
    request:  { "subject_id": int, "tier": "SIMPLE"|"MEDIUM"|"COMPLEX"|null }
    - Jika `tier` diberikan → satu rekomendasi untuk tier tersebut.
    - Jika `tier` null → kembalikan `recommendations` untuk semua tier +
      `primary` (modalitas terbaik yang resource-nya tersedia).
"""
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
    tier: Optional[str] = None
    topic: Optional[str] = None


@router.post("/api/study/route")
async def study_route(req: StudyRouteRequest, db: Session = Depends(get_db)):
    """Rekomendasikan modalitas belajar berdasarkan tier kompleksitas + stok latihan."""
    from models import Subject

    subject = db.query(Subject).filter(Subject.id == req.subject_id).first()
    if not subject:
        return JSONResponse(status_code=404, content={"detail": "Mata kuliah tidak ditemukan."})

    try:
        if req.tier:
            result = modality_route(db, req.subject_id, req.tier, req.topic)
            result["mode"] = "single"
            return JSONResponse(result)

        # Mode "semua tier": tetap satu panggilan DB (snapshot resource dipakai bersama)
        recommendations = []
        primary = None
        # Prioritas primary: flashcard > micro_quiz > socratic (resource nyata dulu)
        priority = {"flashcard": 0, "micro_quiz": 1, "socratic": 2}
        best = None
        for t in VALID_TIERS:
            rec = modality_route(db, req.subject_id, t, req.topic)
            recommendations.append(rec)
            if best is None or priority[rec["modality"]] < priority[best["modality"]]:
                best = rec
        if best is not None:
            primary = best
        return JSONResponse({
            "subject_id": req.subject_id,
            "tier": None,
            "topic": req.topic,
            "mode": "all",
            "primary": primary,
            "recommendations": recommendations,
        })
    except ValueError as e:
        return JSONResponse(status_code=422, content={"detail": str(e)})
