import logging
import datetime
from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import os

from routers import dashboard, subjects, materials, chat, notes, flashcards, quizzes, youtube, settings, exam_analyzer
from database import engine, Base, SessionLocal
import config
from exceptions import add_exception_handlers

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

# Run Database Migrations for drift
def run_migrations():
    import sqlite3
    db_path = os.path.join(config.STORAGE_DIR, "kabayan.db")
    if os.path.exists(db_path):
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("PRAGMA table_info(materials)")
            columns = [col[1] for col in cursor.fetchall()]
            
            if "material_type" not in columns:
                cursor.execute("ALTER TABLE materials ADD COLUMN material_type VARCHAR DEFAULT 'PDF'")
            if "source_url" not in columns:
                cursor.execute("ALTER TABLE materials ADD COLUMN source_url VARCHAR")
            if "external_id" not in columns:
                cursor.execute("ALTER TABLE materials ADD COLUMN external_id VARCHAR")
            if "thumbnail" not in columns:
                cursor.execute("ALTER TABLE materials ADD COLUMN thumbnail VARCHAR")
            if "language" not in columns:
                cursor.execute("ALTER TABLE materials ADD COLUMN language VARCHAR")
            if "status" not in columns:
                cursor.execute("ALTER TABLE materials ADD COLUMN status VARCHAR DEFAULT 'Ready'")
            if "failure_reason" not in columns:
                cursor.execute("ALTER TABLE materials ADD COLUMN failure_reason TEXT")
            if "created_at" not in columns:
                cursor.execute("ALTER TABLE materials ADD COLUMN created_at DATETIME")
            if "updated_at" not in columns:
                cursor.execute("ALTER TABLE materials ADD COLUMN updated_at DATETIME")
            # Exam Analyzer tables (auto-created via SQLAlchemy, no ALTER needed)
            # Exam History: safe to ignore errors if tables already exist
            for ddl in [
                """CREATE TABLE IF NOT EXISTS exam_history_sessions (
                    id INTEGER PRIMARY KEY, subject_id INTEGER, subject_name VARCHAR,
                    title VARCHAR, exam_type VARCHAR, difficulty VARCHAR,
                    bloom_level VARCHAR, question_type VARCHAR, total_questions INTEGER,
                    best_score INTEGER, latest_score INTEGER, grade VARCHAR,
                    progress INTEGER DEFAULT 0, status VARCHAR DEFAULT 'completed',
                    weak_topics_json TEXT, strong_topics_json TEXT,
                    evaluation_json TEXT, questions_json TEXT, answers_json TEXT,
                    created_at DATETIME, updated_at DATETIME)""",
                """CREATE TABLE IF NOT EXISTS exam_attempts (
                    id INTEGER PRIMARY KEY, history_session_id INTEGER,
                    attempt_number INTEGER DEFAULT 1, score INTEGER, grade VARCHAR,
                    total_correct INTEGER, total_wrong INTEGER, duration_seconds INTEGER,
                    questions_json TEXT, answers_json TEXT, evaluation_json TEXT,
                    created_at DATETIME)""",
                """CREATE TABLE IF NOT EXISTS exam_reviews (
                    id INTEGER PRIMARY KEY, attempt_id INTEGER,
                    question_number INTEGER, topic VARCHAR, question_text TEXT,
                    question_type VARCHAR, bloom_level VARCHAR, difficulty VARCHAR,
                    user_answer TEXT, correct_answer TEXT, is_correct INTEGER DEFAULT 0,
                    ai_explanation TEXT, material_ref VARCHAR, tips VARCHAR,
                    item_score INTEGER)""",
                """CREATE TABLE IF NOT EXISTS study_plans (
                    id INTEGER PRIMARY KEY, history_session_id INTEGER,
                    title VARCHAR, motivational_message TEXT, priority_actions_json TEXT,
                    total_days INTEGER DEFAULT 7, completed_days INTEGER DEFAULT 0,
                    progress INTEGER DEFAULT 0, created_at DATETIME, updated_at DATETIME)""",
                """CREATE TABLE IF NOT EXISTS study_plan_items (
                    id INTEGER PRIMARY KEY, plan_id INTEGER, order_number INTEGER DEFAULT 0,
                    day_label VARCHAR, topic VARCHAR, activity TEXT, activity_type VARCHAR,
                    duration_minutes INTEGER, resources TEXT, completed INTEGER DEFAULT 0)""",
                """CREATE TABLE IF NOT EXISTS question_bank (
                    id INTEGER PRIMARY KEY, subject_id INTEGER, blueprint_id INTEGER,
                    chapter VARCHAR, topic VARCHAR, difficulty VARCHAR, bloom_level VARCHAR,
                    question_type VARCHAR, question TEXT, choices_json TEXT,
                    correct_answer VARCHAR, explanation TEXT, material_ref VARCHAR,
                    tips VARCHAR, created_by_ai INTEGER DEFAULT 1,
                    used_count INTEGER DEFAULT 0, created_at DATETIME)""",
            ]:
                try:
                    cursor.execute(ddl)
                except Exception:
                    pass
            
            # Create indexes for performance
            for idx_ddl in [
                "CREATE INDEX IF NOT EXISTS idx_materials_subject_id ON materials (subject_id)",
                "CREATE INDEX IF NOT EXISTS idx_materials_status ON materials (status)",
                "CREATE INDEX IF NOT EXISTS idx_exam_sessions_subject_id ON exam_sessions (subject_id)",
                "CREATE INDEX IF NOT EXISTS idx_exam_sessions_status ON exam_sessions (status)",
                "CREATE INDEX IF NOT EXISTS idx_exam_sessions_subject_status_started ON exam_sessions (subject_id, status, started_at)",
                "CREATE INDEX IF NOT EXISTS idx_exam_attempts_session_id ON exam_attempts (session_id)",
                "CREATE INDEX IF NOT EXISTS idx_exam_reviews_attempt_id ON exam_reviews (attempt_id)",
                "CREATE INDEX IF NOT EXISTS idx_study_plans_session_id ON study_plans (session_id)",
                "CREATE INDEX IF NOT EXISTS idx_study_plan_items_plan_id ON study_plan_items (plan_id)",
                "CREATE INDEX IF NOT EXISTS idx_question_bank_subject_id ON question_bank (subject_id)",
                "CREATE INDEX IF NOT EXISTS idx_notes_subject_id ON notes (subject_id)",
                "CREATE INDEX IF NOT EXISTS idx_flashcards_subject_id ON flashcards (subject_id)",
                "CREATE INDEX IF NOT EXISTS idx_flashcards_subject_created ON flashcards (subject_id, created_at)",
                "CREATE INDEX IF NOT EXISTS idx_quizzes_subject_id ON quizzes (subject_id)",
                "CREATE INDEX IF NOT EXISTS idx_quizzes_subject_created ON quizzes (subject_id, created_at)",
                "CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages (chat_id)",
            ]:
                try:
                    cursor.execute(idx_ddl)
                except Exception:
                    pass
            
            conn.commit()
            conn.close()
            logger.info("Database migration check passed.")
        except Exception as e:
            logger.error(f"Migration error: {e}")

run_migrations()
run_exam_unification_migration()

# ─── Startup: Fix materials stuck on "Processing" ──────────────────────────────
def fix_stuck_materials():
    """Recover materials stuck on 'Processing' from dead background tasks."""
    import models
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
                mat.status = "Failed"
                mat.failure_reason = "Background processing died before completion."
                logger.warning(f"Material {mat.id} marked Failed (no FAISS chunks)")
        db.commit()
        db.close()
    except Exception as e:
        logger.error(f"fix_stuck_materials error: {e}")

fix_stuck_materials()

# Initialize Database
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Kabayan AI Study Workspace")
add_exception_handlers(app)

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    from services.error_handler import safe_json_response
    return safe_json_response(exc, context=f"global [{request.method} {request.url.path}]")

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
        "FAISS": "OK" if os.path.exists(config.FAISS_INDEX_DIR) else "ERROR",
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

