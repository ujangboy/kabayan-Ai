"""Informasi aplikasi + versi — untuk halaman Tentang (Settings)."""
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.services.settings_service import APP_VERSION
from app.schemas.responses import InfoResponse

router = APIRouter()


@router.get("/api/info", response_model=InfoResponse)
async def get_app_info():
    return JSONResponse({
        "app_name": "Kabayan Pintar",
        "version": APP_VERSION,
        "description": "Ruang belajar cerdas berbasis AI: materi, chat, flashcard, quiz, dan simulasi ujian.",
    })