import logging
from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import os

from routers import dashboard, subjects, materials, chat, notes, flashcards, quizzes, youtube, settings, exam_analyzer, exam_history
from database import engine, Base, SessionLocal
import config

# Global Logging Setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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
            conn.commit()
            conn.close()
            logger.info("Database migration check passed.")
        except Exception as e:
            logger.error(f"Migration error: {e}")

run_migrations()

# Initialize Database
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Kabayan AI Study Workspace")

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
app.include_router(exam_history.router)

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

