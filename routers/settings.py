from fastapi import APIRouter, Depends, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from services.settings_service import settings_service

router = APIRouter()

@router.post("/api/settings")
async def save_settings(
    embedding_model: str = Form(...),
    db: Session = Depends(get_db)
):
    settings_service.set_embedding_model(db, embedding_model)
    return JSONResponse({"status": "success", "message": "Embedding model saved"})
