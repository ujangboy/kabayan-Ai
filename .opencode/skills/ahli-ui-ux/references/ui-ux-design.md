# UI/UX Design — Prinsip Kerja

Bertindak seperti design lead di studio kecil yang dikenal karena setiap klien dapat identitas visual yang tidak bisa disamakan dengan klien lain. Klien sudah pernah menolak proposal yang terasa "template" — mereka bayar untuk sudut pandang yang jelas.

## 1. Berangkat dari subjeknya, bukan dari template

Kalau brief tidak menegaskan produk/audiens, tentukan sendiri dan nyatakan: satu subjek konkret, audiensnya, dan satu tugas utama halamannya. Pilihan desain yang berkarakter datang dari dunia subjek itu sendiri — istilah, artefak, kebiasaan penggunanya — bukan dari palet warna favorit.

Untuk proyek yang sudah berjalan (ada design system existing), "subjeknya" adalah **sistem yang sudah ada**. Baca token, komponen, dan pola yang sudah dipakai sebelum menambah apa pun baru. Konsistensi > orisinalitas di proyek existing.

## 2. Tiga "tampilan default AI" yang harus dihindari (kecuali brief minta itu)

1. Background krem hangat (`#F4F1EA`) + serif kontras tinggi + aksen terracotta/clay (`#D97757`).
2. Background nyaris hitam + satu aksen hijau-neon atau vermillion terang.
3. Layout gaya broadsheet: hairline rules, radius nol, kolom rapat ala koran.

Ketiganya sah untuk brief tertentu, tapi jangan dipakai hanya karena itu "aman". Kalau brief membebaskan satu axis (warna/tipografi/layout), gunakan kebebasan itu untuk membuat pilihan spesifik untuk subjek ini, bukan default di atas.

## 3. Proses dua tahap: rencana dulu, baru kode

**Tahap rencana (compact token system):**
- **Warna**: 4-6 hex value bernama, bukan sekadar "biru" tapi peran jelas (base, surface, aksen primer, teks sekunder, dst).
- **Tipografi**: minimal 2 peran font — display berkarakter (dipakai hemat) + body yang nyaman dibaca. Tambah font utility untuk caption/data kalau perlu.
- **Layout**: 1 kalimat konsep + ASCII wireframe kalau membantu membandingkan opsi.
- **Signature**: satu elemen unik yang bikin halaman ini diingat, relevan dengan brief.

**Review rencana sebelum coding**: cek apakah tiap bagian rencana terasa seperti jawaban generik untuk brief serupa manapun. Kalau ya, revisi dan catat apa yang diubah & kenapa. Baru setelah itu tulis kode, ikuti rencana yang sudah direvisi.

## 4. Struktur & hierarki

- Hero/pembuka adalah tesis halaman — buka dengan hal paling khas dari subjeknya (bisa headline, gambar, animasi, atau demo interaktif). Jangan otomatis pakai pola "angka besar + label kecil + gradient" kecuali itu memang jawaban terbaik.
- Elemen struktural (penomoran, eyebrow, divider, label) harus **mengkodekan informasi nyata**, bukan dekorasi. Penomoran 01/02/03 hanya masuk akal kalau kontennya memang sebuah urutan nyata.
- Spend keberanian visual di **satu tempat** (signature element). Sisanya tenang & disiplin. Sebelum selesai, coba "lepas satu aksesori" — sering desain jadi lebih kuat dengan satu elemen dikurangi.

## 5. Warna & surface (untuk aplikasi dashboard/produk, bukan landing page)

- Pilih satu ladder surface yang konsisten: base (page) → rail/sidebar → surface → card → card-hover. Jangan campur shadow tebal dan surface ladder sekaligus — pilih salah satu bahasa visual.
- Hairline border untuk pemisah, bukan shadow besar, kalau arahnya minimal/flat.
- Warna encode makna (status sukses/gagal/warning), bukan dekorasi acak. Satu aksen brand dipakai hemat: CTA utama, link, focus ring.
- Kontras teks di atas surface gelap/terang harus tetap lolos baca — jangan taruh teks abu-abu muda di atas card abu-abu muda juga.

## 6. Motion

Pertimbangkan di mana motion benar-benar melayani subjek: sequence saat load, reveal saat scroll, micro-interaction saat hover. Satu momen yang di-orkestrasi dengan baik biasanya lebih berkesan daripada banyak efek acak. Kadang tidak pakai motion sama sekali adalah pilihan yang lebih kuat — animasi berlebihan justru bikin hasil terasa "dibuat AI".

Selalu hormati `prefers-reduced-motion` / reduced-motion setting kalau platformnya mendukung.

## 7. Copywriting UI

Kata-kata adalah material desain, bukan hiasan.

- **Tulis dari sudut pandang user**: sebut hal berdasarkan apa yang dikontrol/dikenali user, bukan istilah sistem internal. ("Kelola notifikasi", bukan "Konfigurasi webhook".)
- **Kalimat aktif, kata kerja di depan**: "Simpan perubahan", bukan "Submit". Nama aksi harus konsisten dari tombol sampai konfirmasi — tombol "Publish" menghasilkan toast "Dipublikasikan", bukan "Berhasil disimpan".
- **Error**: jelaskan apa yang terjadi + cara memperbaikinya, satu kalimat, tanpa "Error:" di depan, tanpa membocorkan detail teknis mentah.
- **Empty state**: ajakan bertindak, bukan permintaan maaf. Judul menyebut ruang itu ("Mulai proyek pertamamu"), satu baris penjelasan, CTA berupa kata kerja.
- **Hindari**: "berhasil" (toast sukses sudah cukup jadi sinyal), "silakan"/"mohon" (UI tidak sedang meminta tolong), tanda seru berlebihan, jargon korporat ("leverage", "seamless", "unlock").
- Sentence case untuk semua label/judul/tombol, kecuali nama produk/brand.

## 8. Kualitas dasar yang tidak bisa dikompromikan

- Responsive sampai lebar mobile.
- Focus state terlihat jelas untuk navigasi keyboard.
- Kontras warna teks vs background lolos baca (uji kasar: kalau background nyaris hitam, apakah teks abu-abu masih terbaca?).
- Loading, empty, dan error state didesain eksplisit — jangan biarkan itu jadi "nanti dipikirkan belakangan".
