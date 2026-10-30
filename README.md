# Kabayan Pintar

Study workspace berbasis FastAPI + React untuk mengelola mata kuliah, materi,
catatan, flashcard, quiz, simulasi ujian, dan tutor AI.

Proyek ini dibangun dengan **vibe coding** — ditulis sejumlah besar oleh AI
(Kilo/Claude) dengan panduan desain sistem dan arsitektur yang konsisten, lalu
diverifikasi oleh manusia lewat tes dan audit. Cocok sebagai starter untuk
proyek AI-assisted atau untuk dipelajari cara membangun aplikasi AI full-stack.

## Nama

**Kabayan Pintar** (lengkap) / **Kabayan** (pendek). Identifier internal
memakai prefix `kabayan` (database, backup, theme) dan tidak di-rename.

---

## AI yang digunakan

| Leksi | Digunakan untuk |
|-------|-----------------|
| **Groq (llama-3.1-8b-instant / gpt-oss-20b / qwen-vision)** | Chat AI, tutor, generate flashcard & quiz, analisis ujian, RAG |
| **sentence-transformers (all-MiniLM-L6-v2)** | Embedding lokal untuk pencarian vektor (RAG) |
| **LanceDB** | Penyimpanan vektor persisten |

API key Groq **tidak di-commit** — isi di `.env` milik Anda sendiri (lihat di bawah).

---

## Isi proyek

- `app/` — backend FastAPI (entry `app.main:app`): config, database, models, routers, services, parsers, agents, prompts
- `frontend/` — UI React 19 + Vite + Tailwind (port 5173 dev)
- `alembic/` — migrasi database SQLite (source of truth skema)
- `scripts/` — skrip operasi (backup, seed, install)
- `tests/` — tes backend (pytest) + frontend (vitest)
- `docs/` — aturan agent, baseline, konteks AI
- `storage/` — database, upload, vector store (runtime, **tidak di-commit**)

---

## Panduan pemasangan cepat

### Cara 1 — launcher satu baris `kp` (termudah, tanpa `cd`)

```bash
chmod +x kp
./kp --install   # install dependensi dari nol (satu kali saja)
./kp             # nyalakan backend (8000) + frontend (5173), lalu buka browser
```

### Cara 2 — git clone biasa

```bash
git clone <repo-url> kabayan-pintar
cd kabayan-pintar
chmod +x kp
./kp --install && ./kp
```

### Cara 3 — unduh ZIP

Unduh ZIP dari GitHub → ekstrak → masuk folder → jalankan `./kp --install && ./kp`.

### Cara 4 — instalasi satu baris dari luar repo (setelah extract ZIP)

```bash
bash scripts/install.sh   # jalankan di dalam folder proyek
```

Buka browser ke **http://127.0.0.1:5173** (frontend). Backend API di
**http://127.0.0.1:8000** (docs: `/docs`).

> **Port:** `5173` = Vite dev server (frontend development); `8000` = FastAPI
> backend. Saat `npm run build` dipakai (production), semuanya disajikan via
> FastAPI di port 8000.

### Pengaturan wajib sebelum fitur AI jalan

Salin template dan isi `GROQ_API_KEY`:

```bash
cp .env.example .env
# edit .env, masukkan GROQ_API_KEY dari https://console.groq.com/keys
```

`.env` sudah di-`.gitignore` dan **tidak pernah di-commit**. Setiap pengguna
miliki data sendiri di `storage/`.

---

## Tes & quality gates

```bash
# Backend
pytest -q

# Frontend (di folder frontend/)
cd frontend
npm test      # vitest
npm run build # vite production build
npm run lint  # oxlint
```

---

## Database & migrasi

Alembic adalah source of truth skema. Saat aplikasi start, `app/main.py`
menjalankan `alembic upgrade head`.

```bash
alembic current
alembic check   # harus: "No new upgrade operations detected."
```

---

## Teknologi

- Python 3.12 / FastAPI
- SQLAlchemy + Alembic (SQLite)
- React 19 + Vite + Tailwind CSS
- LanceDB + sentence-transformers (RAG)
- Groq (AI chat/tutor/generate)

---

## Lisensi

MIT. Lihat berkas `LICENSE`.

Dokumen penting (folder `docs/`): `ATURAN_KERJA_DENGAN_AGENT.md`,
`PROTECTED_BASELINE.md`, `ai_context.md`.
