# PROTECTED BASELINE — Kabayan AI
## Daftar Fitur/Kode yang SUDAH TERVERIFIKASI BENAR

> **UNTUK AI AGENT: BACA INI SEBELUM MENGERJAKAN BUG FIX APAPUN.**
>
> Semua yang tercantum di sini sudah diverifikasi berfungsi dengan benar
> (dengan bukti konkret — query database, test manual, atau pengecekan
> kode langsung), setelah melalui proses debugging yang panjang.
>
> **Aturan wajib:**
> 1. Kalau task/bug fix yang sedang dikerjakan menyentuh file yang disebut
>    di sini, WAJIB baca dulu bagian terkait sebelum mengubah apapun.
> 2. Kalau perubahan yang direncanakan BERISIKO mengubah perilaku yang
>    sudah diverifikasi ini, STOP dan laporkan dulu ke user sebelum
>    melanjutkan — jangan asumsi "pasti aman".
> 3. Setelah bug fix apapun selesai, WAJIB re-verifikasi ulang poin-poin
>    yang relevan dari list ini (bukan cuma fitur yang baru diperbaiki),
>    untuk memastikan tidak ada regresi tidak sengaja.
> 4. Kalau menemukan salah satu poin di sini TERNYATA sudah rusak/berubah
>    perilakunya, laporkan itu sebagai TEMUAN BARU ke user, jangan
>    diam-diam "diperbaiki lagi" tanpa bilang.

---

## 1. Exam History — Auto-Merge Attempt ke Session yang Sama

**Status:** Terverifikasi lewat query database langsung (bukan cuma UI).

**Bukti:** 5 attempt (score 25, 75, 0, 25, 50) semua tercatat dengan
`history_session_id` yang SAMA, `attempt_number` berurutan 1-5. Tidak ada
duplikat card/session.

**File yang terlibat (JANGAN diubah logic-nya tanpa testing ulang penuh):**
- `services/exam_service.py` — fungsi `generate_questions()`: payload WAJIB
  menyertakan `subject_id` DAN `blueprint_id` (dua-duanya, jangan sampai
  salah satu hilang lagi kalau ada yang edit dict payload ini)
- `services/exam_history_service.py` — fungsi `save_session()`: logic cek
  `existing_session` berdasarkan `blueprint_id` sebelum membuat session baru
- `services/exam_history_service.py` — fungsi `quick_retry_session()`:
  return payload WAJIB menyertakan `blueprint_id` juga (fix terakhir)

**Kalau mengubah `exam_service.py` atau `exam_history_service.py` untuk
alasan lain:** setelah selesai, WAJIB jalankan ulang skenario ini: generate
exam baru → retry 2-3x → cek database, pastikan masih 1 session dengan
beberapa attempt, BUKAN beberapa session terpisah.

---

## 2. Exam — Urutan & Jenis Soal Tetap Konsisten Saat Retry

**Status:** Terverifikasi lewat 5x percobaan retry, hasilnya konsisten
(objective question selalu di depan, subjektif di belakang, tipe soal
tidak berubah).

**File yang terlibat:**
- `services/exam_service.py` — soal di-sort objective-first SEBELUM
  disimpan ke `questions_json` pertama kali
- `services/exam_history_service.py` — fungsi `quick_retry_session()`:
  shuffle HANYA mengacak urutan DI DALAM kelompok (objective tetap
  duluan), dan HANYA mengubah urutan array + re-number field `id` —
  TIDAK BOLEH menyentuh field `type`, `options`, atau `question` dari
  masing-masing soal

**Kalau ada perubahan di logic shuffle/retry:** pastikan tetap baca ulang
dari `questions_json` yang tersimpan (bukan generate ulang dari AI), dan
tipe soal tiap butir tidak berubah dibanding sebelum retry.

---

## 3. Chat — Pemilihan Materi untuk RAG (Checkbox, bukan localStorage buta)

**Status:** Bug lama (materi "nyangkut" terus walau ganti pilihan) sudah
diperbaiki dan diverifikasi.

**File yang terlibat:**
- `frontend/src/store/index.js` — `selectedDocs`, `setSelectedDocs`,
  `clearSelectedDocs`
- Tombol aksi cepat per baris materi (Ringkas/Quiz) TIDAK BOLEH menimpa
  `selectedDocs` secara permanen — itu harus tetap terpisah dari pilihan
  RAG yang aktif di Chat

**Kalau menambah fitur baru yang menyentuh pemilihan materi:** pastikan
tetap pakai pola checkbox eksplisit dengan state yang jelas terlihat oleh
user (badge jumlah materi terpilih), BUKAN balik ke pola localStorage
implisit yang menyebabkan bug lama.

---

## 4. `document_parser.py` — Model AI yang Dipakai (Capability Router)

**Status:** Model sudah di-mapping ke versi yang AKTIF di Groq (per Juli
2026), MENGGANTIKAN model-model lama yang sudah/akan deprecated.

**Mapping yang benar (di `shared/ai_service.py` atau lokasi barunya
setelah migrasi feature-based):**
```python
CAPABILITIES = {
    "chat": "openai/gpt-oss-20b",
    "vision": "qwen/qwen3.8-27b",
    "reasoning": "openai/gpt-oss-120b",
    "summary": "openai/gpt-oss-120b",
    "quiz": "openai/gpt-oss-120b",
    "flashcard": "openai/gpt-oss-20b",
    "prediction": "openai/gpt-oss-120b"
}
```

**Pembaruan Oct 2026 — vision:** `llama-4-scout` sudah DEPRECATED di Groq;
vision sekarang wajib `qwen/qwen3.8-27b` (default `config.GROQ_VISION_MODEL`,
dipakai `POST /api/chat/vision` via groq SDK langsung, JSON mode
`reasoning_effort="none"`). JANGAN kembali ke llama-4-scout.

**JANGAN PERNAH balik ke:** `llama-3.3-70b-versatile`,
`llama-3.2-90b-vision-preview`, atau `deepseek-r1-distill-llama-70b` —
ketiganya sudah dikonfirmasi deprecated/akan di-deprecate Groq. Kalau ada
kebutuhan ganti model lagi di masa depan, WAJIB cek ulang ke
console.groq.com/docs/models dulu, jangan asumsi dari training data.

---

## 5. `main.py` — Patch `uuid_utils` untuk Windows Device Guard

**Status:** Patch aktif di baris awal `main.py`, MEMPERBAIKI masalah
`.pyd` binary yang diblokir Windows Device Guard/WDAC.

**JANGAN DIHAPUS** patch ini tanpa memastikan dulu masalah blocking Windows
Device Guard sudah teratasi permanen dengan cara lain. Patch ini membuat
modul `uuid_utils` palsu (Python murni, bukan Rust/native) dan
menaruhnya ke `sys.modules` SEBELUM baris import yang memicu LangChain
di-load. Urutan penempatan patch ini (harus di paling atas `main.py`,
sebelum `from routers import ...` atau `from features import ...`) itu
KRITIKAL — jangan dipindah ke bawah.

---

## 6. Streaming Response di Chat — Frontend Cek `res.ok` Dulu

**Status:** Sudah diperbaiki — dulu ada bug frontend langsung baca stream
tanpa cek status response, jadi kalau backend error, JSON error mentah
nongol di bubble chat.

**File:** `frontend/src/pages/ChatPage.jsx` (atau lokasi barunya di
`features/chat/frontend/`) — pastikan tetap ada pengecekan `res.ok`
SEBELUM `res.body.getReader()` dipanggil.

---

## 7. Sidebar — Tombol Collapse/Expand Bisa Diklik Dua Arah

**Status:** Bug lama (nggak bisa dibuka lagi setelah ditutup, karena
tombol ke-clip `overflow-hidden` saat lebar sidebar 64px) sudah
diperbaiki.

**File:** `frontend/src/layouts/Sidebar.jsx` — tombol toggle posisinya
sudah diperbaiki supaya tetap ke-render & bisa diklik di kedua kondisi
(collapsed maupun expanded).

---

## 8. Fitur Audio — Trigger + Status Endpoint

**Status:** Sudah diimplementasikan lengkap (bukan cuma trigger tanpa
hasil seperti versi awal).

**File yang terlibat:**
- `services/audio_service.py` — `generate_audio_for_material_async()`,
  jalan via `BackgroundTasks`
- Endpoint `POST /api/materials/{id}/audio` (trigger) DAN
  `GET /api/materials/{id}/audio` (cek status + filepath) — DUA-DUANYA
  harus tetap ada, jangan cuma yang POST
- Frontend: badge status "processing"/"done" + audio player, BUKAN cuma
  `alert()` sekali tampil

---

## 9. Pemilihan Materi Spesifik untuk Exam/Flashcard/Quiz (`MaterialPicker`)

**Status:** Baru saja diimplementasikan (backward-compatible dengan data
lama).

**File yang terlibat:**
- `services/material_service.py` — method `get_by_ids()` (BARU, terpisah
  dari `get_by_subject()` yang lama — jangan hapus/ubah `get_by_subject`,
  masih dipakai sebagai fallback)
- Komponen `MaterialPicker.jsx` (reusable, dipakai di Exam/Flashcard/
  Quiz/Notes) — **ikon pilihan HARUS berbentuk kotak centang (checkbox),
  BUKAN lingkaran (radio button)** — ini sempat jadi bug visual, sudah
  diperbaiki
- `material_ids` di payload SELALU opsional — kosong = pakai semua materi
  di subject (perilaku lama, harus tetap didukung untuk backward
  compatibility)

---

## 10. Struktur Folder — Migrasi Feature-Based (Sebagian Sudah Jalan)

**Status:** Sedang berjalan bertahap (`shared/` sudah dibuat, sebagian
`features/` sudah dipindah). BELUM SELESAI SEPENUHNYA.

**Yang perlu diperhatikan:** ada duplikasi file antara `services/` lama
dan `shared/` baru (misal `ai_service.py`) yang KELIHATANNYA identik —
tapi WAJIB dicek dulu apakah semua import sudah beneran mengarah ke lokasi
baru sebelum menghapus versi lama, jangan asumsi aman untuk dihapus tanpa
`grep` verifikasi menyeluruh.

---

## Cara Pakai Dokumen Ini

Sebelum mulai bug fix apapun, agent harus:
1. Cek apakah task yang dikerjakan menyentuh file-file yang disebut di atas
2. Kalau iya, baca bagian terkait, catat apa yang harus TETAP terjaga
3. Setelah selesai fix, jalankan ulang verifikasi singkat untuk poin-poin
   yang bersinggungan (tidak perlu semua 10 poin, cukup yang relevan
   dengan file yang disentuh)
4. Laporkan hasil verifikasi itu sebagai bagian dari laporan fix, bukan
   cuma laporan fitur yang baru diperbaiki
