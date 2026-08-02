import logging
import datetime
from fastapi import FastAPI
from fastapi.responses import RedirectResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import os

from routers import dashboard, subjects, materials, chat, notes, flashcards, quizzes, youtube, settings, exam_analyzer
from database import engine, Base, SessionLocal
import config
from services.error_handler import register_all_handlers

# Global Logging Setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── Exam Unification Migration ─────────────────────────────────────────────
def run_exam_unification_migration():
    """
    Migrate ExamHistorySession data into ExamSession (unified).
    Steps:
      1. Add new columns to exam_sessions if not already present.
      2. Copy rows from exam_history_sessions to exam_sessions.
      3. Add & populate session_id in exam_attempts and study_plans.
      4. Drop exam_history_sessions table.
    All wrapped in a single transaction.
    """
    db_path = os.path.join(config.STORAGE_DIR, "kabayan.db")
    if not os.path.exists(db_path):
        return
    try:
        import sqlite3
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check migration already done (exam_sessions has 'status' column)
        cursor.execute("PRAGMA table_info(exam_sessions)")
        sess_cols = {col[1] for col in cursor.fetchall()}
        if 'status' in sess_cols:
            # Migration already done; just ensure old table is gone
            cursor.execute("DROP TABLE IF EXISTS exam_history_sessions")
            conn.commit()
            conn.close()
            return

        # Check if source table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='exam_history_sessions'")
        if not cursor.fetchone():
            conn.close()
            return  # No history to migrate

        begin = "BEGIN TRANSACTION"
        commit = "COMMIT"
        rollback = "ROLLBACK"

        cursor.execute(begin)
        try:
            # Step 1: Add new columns to exam_sessions
            new_cols = [
                ("subject_name", "VARCHAR"),
                ("title", "VARCHAR"),
                ("exam_type", "VARCHAR"),
                ("difficulty", "VARCHAR"),
                ("bloom_level", "VARCHAR"),
                ("question_type", "VARCHAR"),
                ("total_questions", "INTEGER"),
                ("best_score", "INTEGER"),
                ("latest_score", "INTEGER"),
                ("grade", "VARCHAR"),
                ("progress", "INTEGER DEFAULT 0"),
                ("status", "VARCHAR DEFAULT 'active'"),
                ("weak_topics_json", "TEXT"),
                ("strong_topics_json", "TEXT"),
                ("updated_at", "DATETIME"),
            ]
            for col_name, col_type in new_cols:
                if col_name not in sess_cols:
                    cursor.execute(f"ALTER TABLE exam_sessions ADD COLUMN {col_name} {col_type}")

            # Step 2: Copy history data into exam_sessions
            cursor.execute("SELECT id, subject_id, subject_name, title, exam_type, difficulty, "
                           "bloom_level, question_type, total_questions, best_score, latest_score, "
                           "grade, progress, status, weak_topics_json, strong_topics_json, "
                           "evaluation_json, questions_json, answers_json, created_at, updated_at "
                           "FROM exam_history_sessions")
            history_rows = cursor.fetchall()

            inserted_ids = []
            if history_rows:
                # Create mapping: old_history_id -> new_session_id
                for row in history_rows:
                    (old_id, subject_id, subject_name, title, exam_type, difficulty,
                     bloom_level, question_type, total_questions, best_score, latest_score,
                     grade, progress, status, weak_topics_json, strong_topics_json,
                     evaluation_json, questions_json, answers_json, created_at, updated_at) = row

                    cursor.execute(
                        """INSERT INTO exam_sessions
                           (blueprint_id, subject_id, subject_name, title, exam_type, difficulty,
                            bloom_level, question_type, total_questions, score, best_score,
                            latest_score, grade, progress, status, weak_topics_json,
                            strong_topics_json, evaluation_json, questions_json, answers_json,
                            started_at, updated_at)
                           VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (subject_id, subject_name, title, exam_type, difficulty,
                         bloom_level, question_type, total_questions,
                         latest_score,    # score = latest_score for history rows
                         best_score, latest_score, grade, progress, status,
                         weak_topics_json, strong_topics_json,
                         evaluation_json, questions_json, answers_json,
                         created_at or datetime.datetime.utcnow(),
                         updated_at or datetime.datetime.utcnow())
                    )
                    inserted_ids.append((old_id, cursor.lastrowid))

                # Step 3: Add session_id to exam_attempts
                cursor.execute("PRAGMA table_info(exam_attempts)")
                attempt_cols = {col[1] for col in cursor.fetchall()}
                if 'session_id' not in attempt_cols:
                    cursor.execute("ALTER TABLE exam_attempts ADD COLUMN session_id INTEGER")
                # Populate session_id from mapping
                for old_id, new_id in inserted_ids:
                    cursor.execute(
                        "UPDATE exam_attempts SET session_id = ? WHERE history_session_id = ?",
                        (new_id, old_id)
                    )

                # Step 4: Add session_id to study_plans
                cursor.execute("PRAGMA table_info(study_plans)")
                plan_cols = {col[1] for col in cursor.fetchall()}
                if 'session_id' not in plan_cols:
                    cursor.execute("ALTER TABLE study_plans ADD COLUMN session_id INTEGER")
                for old_id, new_id in inserted_ids:
                    cursor.execute(
                        "UPDATE study_plans SET session_id = ? WHERE history_session_id = ?",
                        (new_id, old_id)
                    )

            # Step 5: Drop exam_history_sessions (model removed, table no longer needed)
            cursor.execute("DROP TABLE IF EXISTS exam_history_sessions")

            conn.commit()
            logger.info(f"Exam unification migration complete: {len(history_rows) if history_rows else 0} history sessions migrated.")
        except Exception:
            conn.rollback()
            logger.error("Exam unification migration failed, rolled back.")
            raise
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Exam unification migration error: {e}")

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

# Apply pending migrations (upgrade, NOT stamp — stamp would hide unapplied migrations)
try:
    from alembic.config import Config
    from alembic import command
    alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "alembic.ini"))
    command.upgrade(alembic_cfg, "head")
    logger.info("Alembic schema upgraded to head.")
except Exception as e:
    logger.warning(f"Alembic upgrade failed (fresh DB with create_all schema?), stamping head instead: {e}")
    try:
        from alembic.config import Config
        from alembic import command
        alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "alembic.ini"))
        command.stamp(alembic_cfg, "head")
    except Exception as e2:
        logger.warning(f"Alembic stamp skipped (first run?): {e2}")

app = FastAPI(title="Kabayan AI Study Workspace")
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
            mat = db.query(models.Material).filter(models.Material.status == "Pending").first()
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

@app.on_event("startup")
async def startup_event():
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
                        
    asyncio.create_task(material_worker())

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

@app.get("/{full_path:path}")
async def serve_react(full_path: str):
    if full_path.startswith("api/") or full_path.startswith("static/") or full_path.startswith("assets/"):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})

    index_path = os.path.join(DIST_DIR, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path, media_type='text/html')
    return JSONResponse(status_code=404, content={"detail": "Frontend not built"})

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
        status["SQLite"] = f"ERROR: {e}"
        
    all_pass = all(v == "OK" for v in status.values())
    return JSONResponse(status_code=200 if all_pass else 500, content={"status": "PASS" if all_pass else "FAIL", "details": status})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

