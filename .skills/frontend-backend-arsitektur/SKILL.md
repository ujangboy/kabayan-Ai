# SKILL: Desain Frontend & Merapikan Arsitektur Backend

Ringkasan
---
Panduan tersetruktur untuk merancang ulang frontend menjadi komponen terukur dan menyelaraskan, merapikan, serta menstandarkan arsitektur backend agar mudah dipelihara, teruji, dan skalabel.

Ruang lingkup
---
- Workspace-scoped: berlaku untuk repo ini (`kabayan_agent`).
- Fokus pada UI/UX componentization, API contract, data flow, observability, deployment, dan pengujian.

Input yang dibutuhkan
---
- Contoh layar/flows (screenshots, user stories).
- Daftar endpoint API saat ini dan skema DB utama (`models.py`, `alembic` migrations).
- Masalah utama: technical debt, bugs UI, performance hotspots.

Output yang diharapkan
---
- Design system/komponen library (naming, props, storybook suggestion).
- API contract (OpenAPI/JSON schema) dan backward-compat plan.
- Modul backend refactor plan (paket layanan, repository pattern, service layer).
- Test plan: unit, integration, e2e.

Workflow langkah-demi-langkah
---
1. Audit cepat
   - Inventaris komponen frontend (`frontend/src/components`) dan endpoints (`routers/`).
   - Catat duplikasi, state antipattern, dan panggilan API berlebih.

2. Desain sistem & Kontrak
   - Buat atau normalisasi design tokens (warna, spacing, typografi) dan komponen atomic.
   - Definisikan OpenAPI/JSON Schema untuk setiap endpoint publik/internal.

3. Pecah menjadi tugas refactor kecil
   - Prioritaskan berdasarkan dampak pengguna dan risiko (hotfix -> refactor non-blocking).
   - Contoh tugas: ekstrak `Exam` components, buat `api/clients` wrapper, tambahkan DTOs.

4. Implementasi backend layering
   - Perkenalkan `services/` untuk logika bisnis, `repositories/` untuk akses DB, `routers/` untuk HTTP.
   - Tambahkan dependency injection ringan (fungsi factory) untuk memudahkan testing.

5. Compatibility & Migration
   - Gunakan feature flags dan compatibility shims saat mengganti API contract.
   - Rencanakan data migrations (alembic) dan backfill scripts.

6. Testing & Observability
   - Tambah unit tests untuk `services/`, contract tests untuk `routers/`.
   - Terapkan logging terstruktur, tracing (request id), dan metrik dasar (latency, error rates).

7. Docs & Onboarding
   - Tambahkan `frontend/README.md` short guide untuk komponen dan `backend/README.md` arsitektur.

Kriteria kualitas
---
- Komponen UI dapat digunakan ulang dan memiliki dokumentasi singkat.
- Endpoint backend memiliki schema explict dan test coverage minimal.
- Tidak ada breaking changes tanpa feature flag atau migration plan.

Artefak yang dibuat
---
- `frontend/docs/design-tokens.md`, `frontend/components/README.md`.
- `openapi.yaml` atau `docs/api_schema.md`.
- `migrations/` backfill scripts.

Contoh prompt untuk agen
---
- "Gunakan SKILL `frontend-backend-arsitektur`: buat plan refactor untuk `Exam` UI dan endpoint `/api/exam` agar dapat dipakai ulang dan diuji." 
- "Scan `routers/` dan `frontend/src/components` lalu berikan daftar 10 item duplikasi dan saran ekstraksi." 
