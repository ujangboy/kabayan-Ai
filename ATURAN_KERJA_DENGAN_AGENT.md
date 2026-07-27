# ATURAN KERJA DENGAN AI AGENT — Kabayan AI

> Dokumen ini WAJIB dibaca AI agent di awal SETIAP sesi kerja, sebelum
> membaca file lain manapun (termasuk PROTECTED_BASELINE.md dan
> .ai-context.md). Ini kontrak proses, bukan soal fitur/kode.
>
> Kejadian yang melatarbelakangi dokumen ini: agent pernah mengerjakan 3
> batch task sekaligus (padahal instruksi eksplisit bilang "satu-satu,
> lapor dulu sebelum lanjut"), termasuk mengeksekusi perubahan berisiko
> tinggi (rewrite logic FAISS index) yang BELUM disetujui user. Ini
> menyebabkan regresi yang sulit dilacak karena banyak perubahan numpuk
> tanpa checkpoint.

---

## Aturan 1 — Scope Terkunci per Task

Setiap task/prompt yang diberikan HANYA boleh mengerjakan apa yang
diminta secara EKSPLISIT di task itu. Kalau di tengah jalan menemukan hal
lain yang "sekalian bisa diperbaiki" atau "kelihatan berkaitan" —
**JANGAN dikerjakan otomatis**. Laporkan sebagai temuan terpisah, tunggu
instruksi baru.

**Kalimat yang WAJIB dipakai kalau menemukan hal di luar scope:**
> "Saya menemukan [X] di luar scope task ini. Saya TIDAK mengubahnya.
> Apakah Anda ingin saya kerjakan ini juga, atau simpan dulu sebagai
> catatan untuk task terpisah?"

## Aturan 2 — Satu Task = Satu Commit = Satu Laporan

Dilarang menggabungkan beberapa task/fix jadi satu commit besar atau satu
laporan besar, walaupun task-nya diberikan berurutan dalam waktu
berdekatan. Setiap task yang selesai:
1. Di-commit terpisah dengan pesan commit yang jelas (contoh:
   `fix: tambahkan blueprint_id ke payload generate_questions`)
2. Dilaporkan terpisah, LENGKAP (jangan terpotong di tengah)
3. **Tunggu konfirmasi eksplisit dari user** ("lanjut", "oke", dsb)
   sebelum mulai task berikutnya — walau task berikutnya sudah
   disebutkan di prompt yang sama

Ini membuat setiap perubahan bisa di-`git revert` satu-satu tanpa
menghapus perubahan lain yang sudah benar.

## Aturan 3 — Perubahan Berisiko Tinggi WAJIB Approval Eksplisit Sebelum Eksekusi

Kategori "berisiko tinggi" (bukan daftar final, gunakan penilaian yang
sama untuk kasus serupa):
- Mengubah struktur data yang sudah berjalan (index FAISS, schema
  database, format JSON yang tersimpan)
- Migration script yang mengubah/menghapus data
- Menghapus file/kode yang statusnya belum 100% pasti tidak terpakai
- Mengubah logic yang sudah pernah diperbaiki sebelumnya (cek dulu ke
  PROTECTED_BASELINE.md)

Untuk kategori ini, WAJIB kirim **rencana perubahan dulu** (bukan langsung
eksekusi), tunggu kata "APPROVED" atau semacamnya dari user secara
eksplisit, baru kerjakan. Kalau task besar berisi campuran perubahan
low-risk dan high-risk, PISAHKAN — kerjakan yang low-risk dulu, ajukan
rencana terpisah untuk yang high-risk.

## Aturan 4 — Laporan Harus Berisi Bukti, Bukan Klaim

Setiap laporan "sudah selesai"/"sudah benar" WAJIB disertai bukti konkret
yang relevan dengan jenis perubahannya:
- Perubahan data/database → hasil query mentah (bukan ringkasan)
- Perubahan API/endpoint → hasil request/response asli (network log)
- Perubahan UI/frontend → hasil console log dari reproduce manual, atau
  screenshot
- Perubahan logic murni → hasil test case sebelum/sesudah (bukan cuma
  "syntax check passed" — itu cuma membuktikan kode tidak error, bukan
  membuktikan perilakunya benar)

Laporan tanpa bukti konkret akan diminta ulang, bukan diterima.

## Aturan 5 — Kalau Laporan Terpotong, STOP dan Kirim Ulang Lengkap

Jangan lanjut mengerjakan task berikutnya kalau laporan task sebelumnya
belum terkirim lengkap. Kalau ada keterbatasan panjang output, pecah jadi
beberapa pesan berurutan untuk SATU laporan yang sama, jangan campur
dengan mulai task baru.

## Aturan 6 — Kerja di Branch Terpisah untuk Perubahan Besar

Untuk task yang cakupannya besar (migrasi struktur, refactor lintas
banyak file), kerjakan di branch git terpisah, BUKAN langsung di
`master`/branch utama. `master` harus selalu dalam kondisi yang bisa
dijalankan (`git status` bersih, aplikasi bisa start). Merge ke `master`
hanya setelah user mengonfirmasi hasil testing.

**Catatan:** kalau ini membuat banyak branch/worktree menumpuk lagi
seperti kejadian sebelumnya, WAJIB dibereskan (merge atau dihapus)
sebelum membuka branch baru lagi — jangan biarkan lebih dari 1 branch
kerja aktif dalam waktu bersamaan tanpa alasan jelas.

## Aturan 7 — Kalau Ragu, Tanya. Jangan Asumsi "Pasti Ini Maksudnya"

Kalau instruksi ambigu atau bisa ditafsirkan lebih dari satu cara,
tanyakan dulu sebelum eksekusi — terutama untuk keputusan yang sulit
di-undo (hapus data, hapus file, ubah struktur). Menanyakan itu bukan
tanda tidak kompeten, itu yang diharapkan.

---

## Checklist Sebelum Menyatakan Task "Selesai"

- [ ] Hanya mengerjakan yang diminta di scope task ini (Aturan 1)
- [ ] Sudah di-commit terpisah dengan pesan jelas (Aturan 2)
- [ ] Kalau ada perubahan high-risk, sudah dapat approval eksplisit
      sebelum dieksekusi (Aturan 3)
- [ ] Laporan berisi bukti konkret, bukan cuma klaim (Aturan 4)
- [ ] Laporan terkirim utuh, tidak terpotong (Aturan 5)
- [ ] Sudah cross-check ke PROTECTED_BASELINE.md — tidak ada poin di
      situ yang jadi rusak akibat perubahan ini
