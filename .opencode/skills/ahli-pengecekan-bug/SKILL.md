---
name: ahli-pengecekan-bug
description: Panduan triage, diagnosa, dan perbaikan bug lintas backend/frontend/data/AI beserta langkah migrasi/alihat antar lapisan untuk repo kabayan_pintar
---

# SKILL: Pengcekan Bug dan Alih Backend/Frontend/Data/AI

Deskripsi singkat
---
Panduan terstruktur untuk menemukan, mendiagnosis, dan menuntaskan bug yang melibatkan backend, frontend, data, dan komponen AI, termasuk langkah-langkah alih/migrasi (transfer) antar lapisan bila diperlukan.

Ruang lingkup
---
- Workspace-scoped: berlaku untuk repo ini (`kabayan_pintar`).
- Gunakan saat ada bug yang melibatkan satu atau lebih dari: backend (API, DB), frontend (UI, requests), data (skema, integritas), AI (model, inferensi, prompting).

Kapan dipakai
---
- Insiden produksi atau pengujian yang menunjukkan perilaku tak terduga.
- Ketika merencanakan alih/migrasi data atau pengalihan logika dari frontend ke backend (atau sebaliknya) dan perlu langkah aman.

Input yang dibutuhkan
---
- Reproduksi minimal (steps, payload, contoh request/response).
- Akses ke log (backend/frontend), DB query samples, dan contoh data bermasalah.
- Informasi tentang model AI (versi, checkpoint, prompt templates) bila relevan.

Output yang diharapkan
---
- Laporan triage singkat: penyebab diduga, area terdampak, tingkat keparahan.
- Daftar langkah perbaikan terprioritaskan (patch, migration, rollback plan).
- Tes reproduksi otomatis atau manual (post-step checks).
- PR atau skrip migrasi + instruksi deploy/rollback.

Proses langkah-demi-langkah (workflow)
---
1. Reproduksi & Bukti
   - Dapatkan langkah minimal untuk mereproduksi bug (UI clicks, cURL, payload JSON).
   - Simpan log relevan (request IDs, stack traces, model inputs/outputs).

2. Klasifikasi awal (decision point)
   - Apakah masalah terkait:
     - Data (schema mismatch, missing fields, corrupted rows)?
     - Backend (API bug, race condition, DB transaction)?
     - Frontend (bug rendering, bad request, incorrect state management)?
     - AI (model drift, bad prompt, tokenization/encoding issue)?
   - Jika melibatkan >1 area, tandai "cross-cutting" dan buka sub-issue untuk tiap area.

3. Isolasi & Verifikasi
   - Jalankan unit/integration tests lokal yang relevan.
   - Buat reproducer unit test atau small script yang meniru kondisi.
   - Untuk masalah data: jalankan sanity queries, schema diffs, sample checks.
   - Untuk AI: ulangi inferensi secara deterministik (seed, versi), periksa input/output.

4. Rencana Perbaikan
   - Tentukan: quick fix (hotpatch) vs perubahan struktural (migration, refactor).
   - Jika alih (migrasi/transfer) diperlukan, buat rencana migrasi termasuk:
     - Data transformation mapping
     - Backfill vs forward-compat approach
     - Downtime/locking requirements
     - Rollback steps and verification queries

5. Implementasi & Test
   - Implementasikan perbaikan di cabang (branch) terpisah.
   - Tambahkan/ubah tes otomatis (unit/integration) untuk cover kasus.
   - Untuk frontend-backend alih: tambahkan compatibility layer (API shim) bila perlu.
   - Untuk AI changes: tambahkan evaluation script (accuracy/regression checks) dan sample golden inputs.

6. Staging & Canary
   - Deploy ke staging/canary subset.
   - Jalankan regression tests + manual smoke tests.
   - Monitor logs, latency, error rates, and model outputs.

7. Release & Post-check
   - Rollout bertahap jika memungkinkan.
   - Jalankan post-deploy verification scripts.
   - Dokumentasikan perubahan, migrasi dan rollback steps di PR.

8. Postmortem singkat
   - Ringkas akar penyebab, perubahan yang dibuat, dan rekomendasi pencegahan.

Kriteria kualitas & checklist
---
- Reproducer test berhasil sebelum dan gagal setelah perubahan (proves bug existed).
- Unit/integration tests baru lulus di CI.
- Data integrity checks (row counts, schema, sample hashes) lulus.
- Tidak ada regresi fungsional di frontend yang terlihat.
- Untuk AI: evaluasi metrik (accuracy/precision/F1/whatever) tidak menurun di skenario penting.
- Rollback plan diuji (dry-run) dan terdokumentasi.

Keputusan cabang logika (decision points)
---
- Jika penyebab utama adalah data corrupt -> prioritaskan data backfill dan validation rules.
- Jika bug muncul hanya pada client lama -> prefer feature-flag dan compatibility shim.
- Jika AI model menghasilkan output tak terduga -> rollback ke checkpoint stabil dan buat evaluasi comparators.

Artefak yang dibuat
---
- `triage/<issue-id>/report.md` — ringkasan dan bukti.
- `tests/regressions/<issue-id>_reproducer.py` — reproducer/tc.
- `migrations/<timestamp>_transform.sql` atau `backfill_<issue-id>.py`.
- PR dengan deskripsi langkah testing + deploy notes.

Contoh prompt-agent (cara memakai skill)
---
- "Triage bug: pengguna melaporkan 500 pada endpoint /api/submit dengan payload X. Bantu susun checklist triage dan potensi penyebab." 
- "Buat skrip SQL backfill untuk mengisi kolom `user_profile` dari tabel `raw_events` dengan mapping Y->Z." 
- "Bandingkan dua model checkpoint: jelaskan metrik apa yang harus diuji dan buat skrip evaluasi sederhana." 
- "Susun plan alih frontend->backend untuk validasi data (client-side -> server-side) tanpa downtime." 

Pertanyaan klarifikasi yang direkomendasikan
---
- Apakah ada contoh request/response dan log terkait?
- Ada berapa banyak pengguna/rows yang terpengaruh?
- Apakah akses ke staging/DB tersedia? Apakah ada backup yang terbaru?
- Apakah kita dapat melakukan canary deploy atau downtime dijadwalkan?
- Versi model AI mana yang harus dipakai sebagai baseline?

Iterasi & revisi
---
1. Draft skill ini diterapkan pada satu insiden nyata.
2. Tandai bagian yang ambigu (akses, test infra, team ownership).
3. Tanyakan poin klarifikasi yang tercantum di atas.
4. Perbarui SKILL.md dengan contoh nyata (snippet test, sample query, perintah deploy) setelah klarifikasi.

Saran kustomisasi lebih lanjut
---
- Tambahkan checklist CI/CD spesifik (nama workflow, job IDs) untuk repo ini.
- Buat template PR dan issue `triage` otomatis.
- Tambahkan skrip helper untuk evaluasi model di folder `tools/`.

Contoh skrip evaluasi model
---
- Saya menambahkan `tools/evaluate_model.py` yang membaca CSV (`text,label`) dan memanggil
   sebuah modul predictor yang mengekspor `predict(batch)` untuk menghasilkan prediksi.
- Contoh penggunaan:

```bash
python tools/evaluate_model.py \
   --model-module tools.example_predictor \
   --predict-func predict \
   --data tests/data/sample_eval.csv \
   --text-col text --label-col label \
   --output eval_results.json
```

- `tools/example_predictor.py` tersedia sebagai contoh sederhana. Sesuaikan `--model-module`
   untuk memuat wrapper model anda (mis. `services.my_model_wrapper`).

Catatan: skrip menggunakan `pandas`/`numpy` dan menghitung `accuracy`, `macro_f1`,
precision/recall per label, dan confusion matrix tanpa ketergantungan `scikit-learn`.

Langkah selanjutnya yang saya rekomendasikan
---
- Jika setuju, saya bisa:
   - Tambahkan template `tests/data/sample_eval.csv` contoh.
   - Buat wrapper contoh yang memuat model dari `services/` repo ini.
   - Tambahkan GitHub Actions workflow untuk menjalankan evaluasi pada PR.

Contoh perintah cepat untuk agen
---
- "Gunakan skill 'pengcekan bug' untuk triage issue #123." 
- "Terapkan skill: buat backfill script berdasarkan sample CSV ini: <link>"

Lisensi & pemeliharaan
---
- Dokumen ini milik tim repo; perbarui setiap ada proses release atau perubahan arsitektur besar.
