# kabayan_agent

Study workspace berbasis FastAPI + React untuk mengelola mata kuliah, materi,
catatan, flashcard, quiz, simulasi ujian, dan tutor AI.

## Isi

- `app/` — paket backend FastAPI, entry point `app.main:app`
  - `app/main.py` — entry point aplikasi dan lifecycle worker
  - `app/config.py` — konfigurasi environment dan path storage
  - `app/database.py` — koneksi database dan `Base` SQLAlchemy
  - `app/models.py` — model data (SQLAlchemy)
  - `app/routers/` — endpoint API
  - `app/services/` — logika bisnis
  - `app/repositories/` — akses data
  - `app/parsers/` — ekstraksi teks PDF/DOCX/PPTX/XLSX/YouTube
  - `app/agents/` — definisi agent
  - `app/prompts/` — template prompt
- `frontend/` — UI React/Vite + Tailwind
- `alembic/` — migrasi database
- `scripts/` — skrip operasional (backup, seed, rebuild index)
- `tests/` — test backend (pytest)
- `docs/` — dokumen proyek (aturan agent, baseline, konteks AI)

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
uvicorn app.main:app --reload --port 8000
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

Alembic adalah source of truth schema. Saat aplikasi start, `app/main.py`
menjalankan `alembic upgrade head`. Untuk memeriksa drift model vs database:

```bash
alembic current
alembic check     # harus: "No new upgrade operations detected."
```

Test `tests/test_migrations.py` juga memastikan database baru hasil migrasi
memiliki schema yang sama persis dengan `app/models.py`.

## Teknologi

- Python 3.12 / FastAPI
- SQLAlchemy + Alembic (SQLite)
- React 19 + Vite + Tailwind CSS
- LanceDB + sentence-transformers untuk RAG

Dokumen penting (folder `docs/`): `ATURAN_KERJA_DENGAN_AGENT.md`,
`PROTECTED_BASELINE.md`, `ai_context.md`.