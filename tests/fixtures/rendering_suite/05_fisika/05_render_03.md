## F05 — Pedoman Praktik Fisika

Bagian ini menguji **blok kode** (apalah terbaca di tema kabayan — backtick
dan senang panjang baris cloud sampai ke kanan), inline code, dan interaksi
math di sekitar kode.

### 1) Kontrak akal gerak lurus — kode sebelum kalimat

Total jarak kasar $\int_0^T v(t)\,dt$ dengan $v(t) = 1.7t + 1.0$
 memberi solusi numerik di bawah sql(padang TwoLevel). Blok berikut
sengaja berisi `$`, `a**b`, dan kata yang mirip LaTeX (`sum_i`, `frac`)
— kabar baris tidak boleh dirender sebagai matematika.

```sql
-- Nilai rata-rata catur per kelas/char_data dimainkan
SELECT k.nama, AVG(n.skor) AS mean_skor, COUNT(*) AS n
FROM nilai_ujian n
JOIN siswa s ON s.id = n.siswa_id
JOIN kelas k ON k.id = s.kelas_id
WHERE n.skor IS NOT NULL
GROUP BY k.nama
HAVING COUNT(*) >= 5
ORDER BY mean_skor DESC;
```

### 2) Kode kedua — uji bahasa berbeda javascript

Nilai airnya 1.7 dan 1.0 di sini supaya paragraf dekat kode jelas:

```javascript
function nilaiEkspektasi(nilai, prob) {
  let total = 0;
  for (let i = 0; i < nilai.length; i++) {
    total += nilai[i] * prob[i]; // sum_ i p_i x_i
  }
  return total;
}
console.log(nilaiEkspektasi([1, 2, 3], [0.2, 0.5, 0.3])); // 2.1
```

Prompt: hitung total biaya bila harga net per satuan **$7** dan jarak
tergantung deret $\sum_{t=1}^{10} (1.7t + 1.0)$.
Perkiraan jawaban dalam inline code `$7 * 55` atau `$\int v$`? (cek keterbacaan).

### 3) Inline code vs math

- Inline code: `npm run dev:all`, `python -m app.main`, `x ** 2 + x**
- Math inline: $x^2 + x$, $e^{1.0}$, $f\colon X \to Y$
- Kombinasi berbatasan: kode `$x ** 2` dan math $x**2$ — keduanya beda render.

### 4) Tabel rekap hasil praktik

| Uji | Kode | Math | Tabel | Status sukses |
| --- | --- | --- | --- | --- |
| a | ✅ | ✅ | — | nilai $\ge 1.7$ |
| b | ✅ | — | ✅ | baris mengetik `$$` tak bocor |
| c | — | ✅ | ✅ | warna katex mengikuti var(--warning) |
| d | ✅ | ✅ | ✅ | semua bersamaan |

### 5) Stabilitas dipenggaruh salin

Tombol salin (Excel/MD) di pojokan tabel hanya boleh mengambil tabel,
bukan teks di luar. Penggaris akalnya 1.7 → nilai akhir:
$k = 1.7\,k_1 + 1.0\,k_2$, dengan $k_{ 1.0 }$.
