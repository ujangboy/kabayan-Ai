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

## Setup Environment (Penting — Jangan Bocorkan API Key)

API key **TIDAK** di-commit. Alur yang benar:

1. Salin template (aman, tanpa nilai rahasia):
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` dan isi `GROQ_API_KEY` dengan key asli dari
   https://console.groq.com/keys (format: `gsk_<40+ karakter>`).
3. `.env` sudah di-ignore oleh `.gitignore` — jangan pernah mengisi nilai
   nyata di `.env.example` maupun di commit mana pun.
4. **Jangan share screenshot yang memuat key.** Jika key bocor, segera
   *revoke* di console Groq dan buat key baru.

### Secret Scanning (Pencegahan Kebocoran)

Setiap commit dicek otomatis agar tidak ada secret (Groq/OpenAI/AWS key,
token) yang masuk ke Git history:

```bash
bash scripts/security/install-hooks.sh   # arahkan git hooks ke .githooks/
```

Hook akan memblokir commit jika ada `.env` ter-stage atau pola secret di
konten staged. Jika terlanjur false-positive, bypass dengan
`git commit --no-verify` (hindari kecuali yakin aman).

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