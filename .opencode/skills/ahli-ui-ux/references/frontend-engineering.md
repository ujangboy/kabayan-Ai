# Frontend Engineering — Prinsip Kerja

Bertindak seperti frontend engineer senior yang harus maintain kode ini enam bulan dari sekarang, bukan sekadar membuatnya jalan hari ini.

## 1. Struktur komponen

- **Satu komponen, satu tanggung jawab.** Kalau satu file mencampur fetch data + state management + render logic yang kompleks + banyak sub-UI, pecah: hook untuk data/state, komponen presentasional untuk render.
- **Batas ukuran realistis**: kalau file komponen halaman menembus ~300-400 baris, itu sinyal kuat untuk dipecah ke sub-komponen di folder domain terkait, bukan dibiarkan tumbuh terus.
- **Ikuti pola yang sudah ada di codebase.** Sebelum membuat pola baru (struktur folder, cara penamaan hook, cara komponen menerima props), cek dulu apakah proyek sudah punya pola serupa. Konsistensi lintas file mengalahkan preferensi pribadi.
- **Reuse komponen dasar** (button, input, modal, card, empty state, skeleton) yang sudah ada di design system proyek — jangan tulis versi lokal duplikat di dalam halaman.

## 2. State management

- Pilih level state sesuai kebutuhan nyata: state lokal komponen untuk UI sementara (form input, toggle dropdown), state global/store (Zustand/Redux/dst) untuk data yang dipakai lintas halaman, server state (React Query/SWR/dst) untuk data dari API — jangan taruh semua di satu global store besar kalau sebagian sebenarnya cukup lokal.
- Hindari duplikasi sumber kebenaran: kalau data yang sama ditampilkan di dua tempat (misal quick-setting di dropdown dan halaman Settings penuh), pastikan keduanya baca/tulis ke satu sumber state yang sama, bukan dua state terpisah yang bisa out-of-sync.
- Derived state (nilai yang bisa dihitung dari state lain) tidak perlu disimpan sebagai state terpisah — hitung saat render atau pakai memoization kalau costly.

## 3. Integrasi API

- Definisikan kontrak data (bentuk request/response, tipe, error shape) secara eksplisit — pakai TypeScript types/interfaces atau schema validation kalau proyek punya itu.
- Tangani tiga state wajib untuk setiap pemanggilan data: loading, error, dan empty (data kosong tapi request sukses) — ketiganya beda desain dan beda pesan.
- Jangan percaya penuh data dari server tanpa validasi minimal di boundary (null check, default value) — API bisa berubah/error di luar kendali frontend.
- Retry/backoff untuk request yang gagal karena alasan sementara (network), tapi jangan retry otomatis untuk error validasi/permission (4xx logic error).

## 4. Performa

- Hindari re-render yang tidak perlu: pecah komponen besar supaya update satu bagian kecil tidak menggambar ulang seluruh pohon; pakai memoization secukupnya, jangan berlebihan sampai kode susah dibaca.
- Lazy-load route/komponen berat (chart library besar, editor kaya fitur) yang tidak dibutuhkan saat first paint.
- Gambar/asset: ukuran & format sesuai kebutuhan tampil, bukan asal upload resolusi penuh.
- Untuk list panjang, pertimbangkan virtualisasi kalau item bisa mencapai ratusan/ribuan.

## 5. Aksesibilitas (baseline, bukan opsional)

- Semua interaktif elemen bisa dijangkau keyboard (tab order logis, focus state terlihat).
- Label untuk input, alt text untuk gambar bermakna, aria-label untuk icon-only button.
- Kontras warna teks vs background lolos batas baca minimum.
- Ukuran target tap minimal ~40px di mobile untuk elemen yang bisa diklik.

## 6. Responsive

- Desain/kembangkan dengan breakpoint eksplisit dipikirkan sejak awal (bukan ditambal belakangan): umumnya mobile (~375px), tablet (~768px), desktop (1280px+).
- Elemen shell (sidebar, navigasi, panel kontekstual) butuh strategi jelas di layar sempit: collapse, overlay, atau reflow — bukan sekadar menyusut sampai rusak.

## 7. Error boundary & resiliency

- Bungkus area yang render-nya bisa gagal (misal karena data tak terduga) dengan error boundary supaya satu bagian rusak tidak menjatuhkan seluruh halaman.
- Pesan error di UI harus actionable untuk user (lihat prinsip copywriting di `ui-ux-design.md`), sementara detail teknis penuh cukup di console/log, bukan ditampilkan mentah ke user.

## 8. Sebelum menyatakan selesai

- Apakah komponen baru ini konsisten secara visual dengan desain system yang sudah ada (warna, spacing, radius dari token, bukan hardcode)?
- Apakah ada state (loading/error/empty) yang terlewat?
- Apakah ukuran file & struktur masih masuk akal untuk dirawat orang lain?
- Apakah sudah dicoba secara logis di breakpoint sempit, bukan cuma desktop?
