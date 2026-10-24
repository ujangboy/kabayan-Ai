import os
import re
import logging
from dotenv import load_dotenv

load_dotenv()

# --- Server Configurations ---
APP_TITLE = "Personal Knowledge Base"
SERVER_HOST = "127.0.0.1"
SERVER_PORT = 7860

# --- API Configurations ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
if not GROQ_API_KEY:
    logging.warning(
        "GROQ_API_KEY belum diatur — fitur AI (chat, tutor, quiz, exam) tidak akan "
        "berfungsi. Isi file .env dan restart backend."
    )
elif not re.fullmatch(r"gsk_[A-Za-z0-9]{20,}", GROQ_API_KEY):
    # Fail-loud: key salah format (mis. terpotong, typo, atau key dari
    # screenshot yang tidak lengkap) akan membuat semua request Groq gagal.
    logging.error(
        "[SECRET-FORMAT] GROQ_API_KEY terdeteksi format tidak valid — harus diawali "
        "'gsk_' diikuti >=20 karakter alfanumerik. Periksa kembali isi .env. "
        "JANGAN salin key dari screenshot/teks yang terpotong."
    )
# Default model must be a valid Groq model. Override via GROQ_MODEL env var
# if your account has access to a different one.
# Akun Groq ini tidak punya akses ke llama-3.1-8b-instant; pakai gpt-oss-20b
# (ringan, respons bersih tanpa blok <think>). Cek model via groq models.list().
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

# We use sentence-transformers locally for embeddings
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
TEMPERATURE = 0.2

# --- Chunking Constants ---
CHUNK_SIZE = 200 # words (max 256 token embedder all-MiniLM-L6-v2)
CHUNK_OVERLAP = 50 # words

# --- Paths Configuration ---
# BASE_DIR = root repo (satu level di atas app/) — storage/, static/,
# frontend/dist, dan alembic.ini semuanya relatif ke root, bukan ke app/.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORAGE_DIR = os.path.join(BASE_DIR, "storage")
LANCEDB_DIR = os.path.join(STORAGE_DIR, "lancedb")
TEXT_CACHE_DIR = os.path.join(STORAGE_DIR, "text_cache")
UPLOADS_DIR = os.path.join(STORAGE_DIR, "uploads")
SESSION_DIR = os.path.join(STORAGE_DIR, "sessions")
TRASH_DIR = os.path.join(STORAGE_DIR, "trash")
BACKUPS_DIR = os.path.join(STORAGE_DIR, "backups")

# Jangka waktu file di trash sebelum benar-benar dihapus (safety-net, D2)
TRASH_RETENTION_DAYS = 7

# Batas harian (sliding 24 jam) estimasi token Groq untuk fitur Limit AI.
# Angka ini perkiraan (bukan kuota hard Groq); dipakai untuk progress bar UI.
GROQ_DAILY_LIMIT = int(os.getenv("GROQ_DAILY_LIMIT", "8000"))

# --- CORS ---
# Default: origin eksplisit localhost (dev Vite 5173 + FastAPI 7860/8000).
# Wildcard "*" hanya sebagai fallback bila env CORS_ORIGINS="*" diset eksplisit
# (mis. deploy terkontrol). JANGAN biarkan "*" sebagai default di jaringan publik —
# set CORS_ORIGINS ke daftar origin eksplisit, dipisah koma, contoh:
#   CORS_ORIGINS=http://localhost:7860,https://kabayan.example.com
_DEFAULT_CORS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:7860",
    "http://127.0.0.1:7860",
]
_env_cors = os.getenv("CORS_ORIGINS")
CORS_ORIGINS = (
    [o.strip() for o in _env_cors.split(",") if o.strip()]
    if _env_cors else _DEFAULT_CORS
)

# Ensure directories exist
for path in [LANCEDB_DIR, TEXT_CACHE_DIR, UPLOADS_DIR, SESSION_DIR, TRASH_DIR, BACKUPS_DIR]:
    os.makedirs(path, exist_ok=True)

# --- File Organizer Settings (Legacy) ---
FILE_CATEGORIES = {
    "PDF_Files": [".pdf"],
    "Word_Documents": [".docx", ".doc"],
    "Excel_Sheets": [".xlsx", ".xls", ".csv"],
    "Code_Files": [".py", ".js", ".html", ".css", ".java", ".cpp", ".c", ".ts", ".go", ".rs"],
    "Images": [".jpg", ".jpeg", ".png", ".gif", ".bmp"],
    "Text_Files": [".txt", ".md", ".json", ".xml", ".yaml", ".yml"],
    "Archives": [".zip", ".rar", ".tar", ".gz", ".7z"]
}
