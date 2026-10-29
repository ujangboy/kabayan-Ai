# Fixture Uji Rendering Kabayan Pintar

Dihasilkan oleh `scripts/testing/generate_rendering_fixtures.py` (seed=2026).
Struktur: **10 folder temA × 3 file** = 30 file markdown. Setiap file mengandung
campuran LaTeX (inline `$` & varian `\[..\]`, `\(..\)`), tabel GFM, dan blok kode.

## Tujuan tiap tipe file

| File | Fokus uji | Kebocoran yang dideteksi |
| --- | --- | --- |
| `01_*` | math inline/block + tabel kecil dgn math di sel | KaTeX error, heading rusak, `$` uang salah dirender |
| `02_*` | matriks pmatrix, tabel lebar x overflow, `\[..\]` | kolom tabel roboh, dolar literal merusak baris |
| `03_*` | 2 blok kode beda bahasa + tabel + kombinasi `$` | highlighter gagal, inline code dirubah jadi math |

## Cara pemakaian

1. Jalankan app, buka Chat → mode **Tutor aktif**.
2. Tempel isi salah satu file ke pesan awal atau generate notebook/quiz/flashcard
   dengan konten file sebagai sumber.
3. Bandingkan: apakah formula ditampilkan penuh, tabel tidak lolos batas,
   kode berwarna & terbaca, tombol salin tersedia.

