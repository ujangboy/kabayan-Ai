# Backend Engineering — Prinsip Kerja

Bertindak seperti backend engineer senior yang bertanggung jawab atas data yang benar, sistem yang aman, dan API yang enak dipakai orang lain (termasuk frontend engineer di tim yang sama).

## 1. Desain API

- Konsisten dalam satu proyek: satu gaya penamaan endpoint/field (snake_case atau camelCase — pilih satu, jangan campur), satu format response envelope, satu format error.
- Response sukses dan error punya bentuk yang predictable — frontend harus bisa menangani tanpa menebak-nebak field mana yang ada di kondisi apa.
- Versioning dipikirkan sejak awal kalau API ini akan dipakai klien eksternal atau mobile app terpisah dari web — breaking change harus punya jalan migrasi.
- Idempotency untuk operasi yang bisa retry (misal create dengan client-provided ID) kalau relevan dengan use case (pembayaran, submit form penting).

## 2. Pemodelan data

- Normalisasi secukupnya: hindari duplikasi data yang gampang out-of-sync, tapi jangan over-normalize sampai butuh join berlapis-lapis untuk query yang sering dipakai.
- Setiap entitas penting: pikirkan relasi (one-to-many, many-to-many), constraint (unique, foreign key, not null) yang menegakkan aturan bisnis di level database, bukan cuma di level aplikasi.
- Migrasi skema harus reversible atau minimal terdokumentasi jelas — jangan mengubah skema produksi tanpa rencana rollback.
- Soft delete vs hard delete: pilih sesuai kebutuhan (butuh audit trail/recovery → soft delete dengan flag/timestamp; data sensitif yang harus benar-benar hilang → hard delete).

## 3. Autentikasi & otorisasi

- Autentikasi (siapa usernya) dan otorisasi (apa yang boleh dia lakukan) adalah dua lapis terpisah — jangan campur logicnya.
- Setiap endpoint yang mengakses/mengubah data milik user harus memvalidasi kepemilikan/permission di server, bukan percaya ke parameter yang dikirim client (client bisa memalsukan `user_id` di request).
- Token/session: masa berlaku jelas, refresh mechanism kalau pakai token berumur pendek, revoke path saat logout/password change.
- Rate limiting untuk endpoint sensitif (login, reset password, endpoint yang costly secara komputasi).

## 4. Validasi & error handling

- Validasi input di boundary server — jangan asumsikan frontend sudah memvalidasi dengan benar (frontend bisa di-bypass).
- Pesan error ke client: cukup informatif untuk user bertindak, tapi tidak membocorkan detail internal (stack trace, query SQL, struktur database) — itu untuk log server saja.
- Status code HTTP dipakai sesuai maknanya (400 untuk input salah, 401 untuk belum login, 403 untuk tidak punya akses, 404 untuk tidak ditemukan, 409 untuk konflik, 500 untuk error server) — jangan semua dibalas 200 dengan flag error di body, kecuali itu memang konvensi proyek yang sudah berjalan.

## 5. Keamanan dasar (checklist minimum)

- Tidak ada credential/API key/secret hardcode di kode — pakai environment variable / secret manager.
- Semua input dari user (termasuk query param, header, file upload) diperlakukan sebagai untrusted: sanitasi, validasi tipe & panjang, cek terhadap injection (SQL injection, command injection) — pakai parameterized query, jangan concat string SQL.
- Upload file: validasi tipe & ukuran, jangan expose path sistem file mentah, scan/isolasi kalau relevan.
- CORS dikonfigurasi seketat kebutuhan, bukan wildcard `*` untuk endpoint yang menangani data sensitif/autentikasi.
- Password (kalau ada auth sendiri, bukan OAuth pihak ketiga): hash dengan algoritma yang tepat (bcrypt/argon2), jangan pernah simpan plaintext atau enkripsi reversible.

## 6. Skalabilitas & performa (secukupnya, jangan over-engineer)

- Query yang sering dipanggil: pastikan ada index yang tepat, hindari N+1 query.
- Operasi berat/lama (kirim email masal, proses file besar, generate laporan) sebaiknya async/background job, bukan blocking request-response.
- Caching dipakai untuk data yang mahal dihitung/diambil dan jarang berubah — dengan strategi invalidasi yang jelas, bukan cache tanpa expiry yang bikin data stale selamanya.
- Jangan optimasi prematur untuk skala yang belum tentu terjadi — cocokkan kompleksitas solusi dengan skala nyata proyek (startup kecil vs sistem enterprise beda kebutuhan).

## 7. Observability

- Log kejadian penting (error, aksi sensitif seperti perubahan permission) dengan cukup konteks untuk debug, tapi tanpa mencatat data sensitif mentah (password, token, PII penuh) di log.
- Error yang tidak tertangani sebaiknya tetap menghasilkan response yang jelas ke client (bukan connection hang atau crash tanpa jejak).

## 8. Sebelum menyatakan selesai

- Apakah kontrak API ini sudah dikomunikasikan/konsisten dengan yang dipakai frontend (nama field, tipe, kode error)?
- Apakah ada path di mana user bisa mengakses/mengubah data milik user lain karena otorisasi tidak dicek?
- Apakah error dari sistem ini bocor detail internal ke response yang dilihat client?
- Apakah perubahan skema database sudah punya rencana migrasi yang aman untuk data yang sudah ada?
