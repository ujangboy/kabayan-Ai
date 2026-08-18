# kabayan_agent

Agent AI berbasis FastAPI untuk otomatisasi pekerjaan dan asisten pengembangan.

## Isi

- `main.py` — entry point aplikasi
- `config.py` — konfigurasi
- `database.py` — koneksi database
- `models.py` — model data (SQLAlchemy)
- `routers/` — endpoint API
- `services/` — logika bisnis
- `repositories/` — akses data
- `agents/` — definisi agent
- `features/` — fitur-fitur
- `prompts/` — template prompt
- `frontend/` — UI frontend
- `alembic/` — migrasi database

## Cara Menjalankan

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

## Teknologi

- Python 3 / FastAPI
- SQLAlchemy + Alembic
- Frontend (React/Vite)

Dokumen penting: `ATURAN_KERJA_DENGAN_AGENT.md`, `PROTECTED_BASELINE.md`, `ai_context.md`.