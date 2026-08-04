import os
from dotenv import load_dotenv

load_dotenv()

# --- Server Configurations ---
APP_TITLE = "Personal Knowledge Base"
SERVER_HOST = "127.0.0.1"
SERVER_PORT = 7860

# --- API Configurations ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# We use sentence-transformers locally for embeddings
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
TEMPERATURE = 0.2

# --- Chunking Constants ---
CHUNK_SIZE = 200 # words (max 256 token embedder all-MiniLM-L6-v2)
CHUNK_OVERLAP = 50 # words

# --- Paths Configuration ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STORAGE_DIR = os.path.join(BASE_DIR, "storage")
LANCEDB_DIR = os.path.join(STORAGE_DIR, "lancedb")
TEXT_CACHE_DIR = os.path.join(STORAGE_DIR, "text_cache")
UPLOADS_DIR = os.path.join(STORAGE_DIR, "uploads")
SESSION_DIR = os.path.join(STORAGE_DIR, "sessions")
TRASH_DIR = os.path.join(STORAGE_DIR, "trash")

# Jangka waktu file di trash sebelum benar-benar dihapus (safety-net, D2)
TRASH_RETENTION_DAYS = 7

# Ensure directories exist
for path in [LANCEDB_DIR, TEXT_CACHE_DIR, UPLOADS_DIR, SESSION_DIR, TRASH_DIR]:
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
