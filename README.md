# kabayan_agent

Study workspace berbasis FastAPI + React untuk mengelola mata kuliah, materi,
catatan, flashcard, quiz, simulasi ujian, dan tutor AI.

## Isi

- `main.py` — entry point aplikasi dan lifecycle worker
- `config.py` — konfigurasi environment dan path storage
- `database.py` — koneksi database dan `Base` SQLAlchemy
- `models.py` — model data (SQLAlchemy)
- `routers/` — endpoint API
- `services/` — logika bisnis
- `repositories/` — akses data
- `parsers/` — ekstraksi teks PDF/DOCX/PPTX/XLSX/YouTube
- `agents/` — definisi agent
- `prompts/` — template prompt
- `frontend/` — UI React/Vite + Tailwind
- `alembic/` — migrasi database
- `tests/` — test backend (pytest)

Data runtime (database, upload, vector store, backup) disimpan di `storage/`
dan tidak di-commit.

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

Backend:

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Frontend (terminal terpisah):

```bash
cd frontend
npm ci
npm run dev
```

Atau jalankan keduanya sekaligus dari folder `frontend`:

```bash
npm run dev:all
```

## Test & Quality Gates

Backend:

```bash
pytest -q
```

Frontend:

```bash
cd frontend
npm test          # vitest
npm run build     # vite production build
npm run lint      # oxlint
```

## Database & Migrasi

Alembic adalah source of truth schema. Saat aplikasi start, `main.py`
menjalankan `alembic upgrade head`. Untuk memeriksa drift model vs database:

```bash
alembic current
alembic check     # harus: "No new upgrade operations detected."
```

Test `tests/test_migrations.py` juga memastikan database baru hasil migrasi
memiliki schema yang sama persis dengan `models.py`.

## Teknologi

- Python 3.12 / FastAPI
- SQLAlchemy + Alembic (SQLite)
- React 19 + Vite + Tailwind CSS
- LanceDB + sentence-transformers untuk RAG

Dokumen penting: `ATURAN_KERJA_DENGAN_AGENT.md`, `PROTECTED_BASELINE.md`, `ai_context.md`.