from fastapi import APIRouter, Request, Depends, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from database import get_db
from services.settings_service import settings_service

router = APIRouter()
templates = Jinja2Templates(directory="templates")

@router.get("/settings", response_class=HTMLResponse)
async def get_settings(request: Request, db: Session = Depends(get_db)):
    embedding_model = settings_service.get_embedding_model(db)
    
    return templates.TemplateResponse(
        request=request,
        name="settings.html",
        context={
            "active_page": "settings",
            "embedding_model": embedding_model
        }
    )

@router.post("/api/settings")
async def save_settings(
    embedding_model: str = Form(...),
    db: Session = Depends(get_db)
):
    settings_service.set_embedding_model(db, embedding_model)
    # Redirect back to settings with success (using a query param for simplicity)
    return RedirectResponse(url="/settings?success=1", status_code=303)
