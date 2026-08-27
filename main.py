import logging
import datetime
from time_utils import utcnow
from fastapi import FastAPI
from fastapi.responses import RedirectResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import os

from routers import dashboard, subjects, materials, chat, notes, flashcards, quizzes, youtube, settings, exam_analyzer, tutor, profile, info, data, trash, study
from database import engine, Base, SessionLocal
import config
from services.error_handler import register_all_handlers

# Global Logging Setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── Startup: Fix materials stuck on "Processing" ──────────────────────────────
def fix_stuck_materials():
    """Recover materials stuck on 'Processing' from dead background tasks."""
    import models
    import os
    from services.rag_service import rag_service as _rag
    try:
        db = SessionLocal()
        stuck = db.query(models.Material).filter(models.Material.status == "Processing").all()
        for mat in stuck:
            doc_id = f"mat_{mat.id}"
            has_chunks = any(m.get("doc_id") == doc_id for m in _rag.chunk_metadata)
            if has_chunks:
                mat.status = "Ready"
                mat.failure_reason = None
                logger.info(f"Recovered stuck material {mat.id} -> Ready (FAISS chunks found)")
            else:
                if mat.filepath and os.path.exists(mat.filepath):
                    mat.status = "Pending"
                    mat.failure_reason = None
                    logger.info(f"Recovered stuck material {mat.id} -> Pending (Re-queueing)")
                else:
                    mat.status = "Failed"
                    mat.failure_reason = "Background processing died and file is missing."
                    logger.warning(f"Material {mat.id} marked Failed (missing file)")
        db.commit()
        db.close()
    except Exception as e:
        logger.error(f"fix_stuck_materials error: {e}")

fix_stuck_materials()

# Clean stale LanceDB lock files from unexpected shutdowns
try:
    for fname in os.listdir(config.LANCEDB_DIR):
        if fname.endswith(".lck"):
            fpath = os.path.join(config.LANCEDB_DIR, fname)
            try:
                os.remove(fpath)
                logger.warning(f"Cleaned stale LanceDB lock file: {fname}")
            except Exception:
                pass
except Exception:
    pass


# Initialize Database (Alembic is source of truth for schema)
Base.metadata.create_all(bind=engine)

# Apply pending migrations (upgrade, NOT blind-stamp — stamp would hide unapplied migrations)
try:
    from alembic.config import Config
    from alembic import command
    alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "alembic.ini"))
    command.upgrade(alembic_cfg, "head")
    logger.info("Alembic schema upgraded to head.")
except Exception as e:
    # Stamp hanya sah untuk BOOTSTRAP: DB dibuat via create_all (semua tabel
    # sudah ada) sehingga migrasi 001 gagal "table already exists", dan tabel
    # alembic_version belum ada. Selain kasus itu, kegagalan upgrade = drift
    # skema nyata — JANGAN stamp (dulu menyamarkan drift secara permanen).
    try:
        from sqlalchemy import inspect as sa_inspect
        insp = sa_inspect(engine)
        versioned = insp.has_table("alembic_version")
    except Exception:
        versioned = True  # tak bisa memastikan → perlakukan sebagai drift
    if not versioned:
        logger.info(f"Alembic bootstrap: mendaftarkan DB create_all sebagai head ({e})")
        try:
            from alembic.config import Config
            from alembic import command
            alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "alembic.ini"))
            command.stamp(alembic_cfg, "head")
        except Exception as e2:
            logger.warning(f"Alembic stamp skipped (first run?): {e2}")
    else:
        logger.critical(
            f"Alembic upgrade GAGAL pada DB yang sudah ter-versioning — "
            f"skema kemungkinan drift dan TIDAK di-stamp. Perbaiki sebelum lanjut: {e}"
        )

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Cleanup LanceDB orphaned locks
    if os.path.exists(config.LANCEDB_DIR):
        for root, dirs, files in os.walk(config.LANCEDB_DIR):
            for file in files:
                if file.endswith(".lck"):
                    try:
                        os.remove(os.path.join(root, file))
                        logger.info(f"Cleaned up orphaned lock file: {file}")
                    except Exception as e:
                        logger.warning(f"Failed to remove lock file {file}: {e}")

    # Recovery: materi yang terjebak "Processing" saat server restart
    import models
    try:
        db = SessionLocal()
        cutoff = utcnow() - datetime.timedelta(minutes=30)
        for m in db.query(models.Material).filter(
            models.Material.status == "Processing",
            models.Material.updated_at < cutoff
        ).all():
            if m.material_type == models.MaterialType.YOUTUBE:
                m.status = "Failed"
                m.failure_reason = "Proses terputus (server restart). Silakan import ulang."
                logger.warning(f"Recovery: YouTube material {m.id} di-set Failed (restart).")
            else:
                m.status = "Pending"  # worker akan memproses ulang dari awal
                m.progress = 0
                logger.warning(f"Recovery: material {m.id} di-set Pending untuk diproses ulang (restart).")
        db.commit()
        db.close()
    except Exception as e:
        logger.warning(f"Recovery stuck rows gagal: {e}")

    # C5/D2/D3: sweep file yatim ke trash + bersihkan trash kedaluwarsa + temp yt-dlp
    try:
        db = SessionLocal()
        from services.storage_cleanup_service import cleanup_orphan_files, cleanup_trash, cleanup_ytdlp_temp
        cleanup_orphan_files(db)
        db.close()
        cleanup_trash()
        cleanup_ytdlp_temp()
    except Exception as e:
        logger.warning(f"Storage cleanup startup gagal: {e}")

    asyncio.create_task(material_worker())
    yield

app = FastAPI(title="Kabayan AI Study Workspace", lifespan=lifespan)
register_all_handlers(app)

import asyncio
from concurrent.futures import ThreadPoolExecutor

material_executor = ThreadPoolExecutor(max_workers=2)

async def material_worker():
    """Background worker loop to process pending materials."""
    import models
    from services.material_service import material_service
    while True:
        try:
            db = SessionLocal()
            mat = db.query(models.Material).filter(
                models.Material.status == "Pending",
                models.Material.material_type != models.MaterialType.YOUTUBE  # YouTube diproses oleh youtube_service
            ).first()
            if mat:
                mat.status = "Processing"
                db.commit()
                filepath = mat.filepath
                mat_id = mat.id
                db.close()
                
                logger.info(f"Worker picked up material {mat_id} for processing.")
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(material_executor, material_service.process_material_async, filepath, f"mat_{mat_id}", mat_id)
            else:
                db.close()
                await asyncio.sleep(2)
        except Exception as e:
            logger.error(f"material_worker error: {e}")
            await asyncio.sleep(5)

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static folders
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

DIST_DIR = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.isdir(DIST_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_DIR, "assets")), name="assets")
    # Self-hosted fonts (build output dari public/fonts) — agar UI konsisten
    # saat di-serve langsung lewat FastAPI (tanpa Vite dev server).
    FONTS_DIR = os.path.join(DIST_DIR, "fonts")
    if os.path.isdir(FONTS_DIR):
        app.mount("/fonts", StaticFiles(directory=FONTS_DIR), name="fonts")

# Include Routers
app.include_router(dashboard.router)
app.include_router(subjects.router)
app.include_router(materials.router)
app.include_router(chat.router)
app.include_router(notes.router)
app.include_router(flashcards.router)
app.include_router(quizzes.router)
app.include_router(youtube.router)
app.include_router(settings.router)
app.include_router(exam_analyzer.router)
app.include_router(tutor.router)
app.include_router(profile.router)
app.include_router(info.router)
app.include_router(data.router)
app.include_router(trash.router)
app.include_router(study.router)

@app.get("/")
async def get_home():
    return RedirectResponse(url="/dashboard", status_code=303)

@app.get("/health")
async def health_check():
    status = {
        "FastAPI": "OK",
        "SQLite": "ERROR",
        "Schema_Materials": "ERROR",
        "Groq API": "OK" if config.GROQ_API_KEY else "ERROR",
        "LanceDB": "OK" if os.path.exists(config.LANCEDB_DIR) else "ERROR",
        "Upload Folder": "OK" if os.path.exists(config.UPLOADS_DIR) else "ERROR",
        "Embedding": "OK", # LangChain initialized locally in rag_service
        "Cache": "OK"
    }
    try:
        from sqlalchemy import text
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        status["SQLite"] = "OK"
        
        # Check Schema Drift
        res = db.execute(text("PRAGMA table_info(materials)")).fetchall()
        columns = [row[1] for row in res]
        if "material_type" in columns:
            status["Schema_Materials"] = "OK"
        else:
            status["Schema_Materials"] = "DRIFT_DETECTED"
            
        db.close()
    except Exception as e:
        # Jangan bocorkan detail DB/driver ke client — log saja
        logger.error(f"/health SQLite check error: {e}")
        status["SQLite"] = "ERROR"
        
    all_pass = all(v == "OK" for v in status.values())
    return JSONResponse(status_code=200 if all_pass else 500, content={"status": "PASS" if all_pass else "FAIL", "details": status})

# SPA fallback — DAFTARKAN PALING AKHIR agar /health, /, dan route lain menang dulu
@app.get("/{full_path:path}")
async def serve_react(full_path: str):
    if full_path.startswith("api/") or full_path.startswith("static/") or full_path.startswith("assets/"):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})

    index_path = os.path.join(DIST_DIR, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path, media_type='text/html')
    return JSONResponse(status_code=404, content={"detail": "Frontend not built"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

