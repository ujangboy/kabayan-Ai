from fastapi import APIRouter, Depends, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.settings_service import settings_service
from app.schemas.common import StatusMessage

router = APIRouter()

# Allowlist model embedding yang diizinkan — nilai bebas dari client bisa
# membuat loading model gagal saat dipakai (dan mengacaukan cache hash).
ALLOWED_EMBEDDING_MODELS = {"all-MiniLM-L6-v2", "paraphrase-multilingual-MiniLM-L12-v2"}

@router.post("/api/settings", response_model=StatusMessage)
async def save_settings(
    embedding_model: str = Form(..., max_length=120),
    db: Session = Depends(get_db)
):
    if embedding_model not in ALLOWED_EMBEDDING_MODELS:
        return JSONResponse(status_code=422, content={"detail": "Model embedding tidak dikenal. Pilihan: " + ", ".join(sorted(ALLOWED_EMBEDDING_MODELS))})
    settings_service.set_embedding_model(db, embedding_model)
    return JSONResponse({"status": "success", "message": "Embedding model saved"})
