## F08 — Pedoman Praktik Geometri

Bagian ini menguji **blok kode** (apalah terbaca di tema kabayan — backtick
dan senang panjang baris cloud sampai ke kanan), inline code, dan interaksi
math di sekitar kode.

### 1) Kontrak akal trigonometri — kode sebelum kalimat

Total jarak kasar $\int_0^T v(t)\,dt$ dengan $v(t) = 2.9t + 2.6$
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

Nilai airnya 2.9 dan 2.6 di sini supaya paragraf dekat kode jelas:

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
tergantung deret $\sum_{t=1}^{10} (2.9t + 2.6)$.
Perkiraan jawaban dalam inline code `$7 * 55` atau `$\int v$`? (cek keterbacaan).

### 3) Inline code vs math

- Inline code: `npm run dev:all`, `python -m app.main`, `x ** 2 + x**
- Math inline: $x^2 + x$, $e^{2.6}$, $f\colon X \to Y$
- Kombinasi berbatasan: kode `$x ** 2` dan math $x**2$ — keduanya beda render.

### 4) Tabel rekap hasil praktik

| Uji | Kode | Math | Tabel | Status sukses |
| --- | --- | --- | --- | --- |
| a | ✅ | ✅ | — | nilai $\ge 2.9$ |
| b | ✅ | — | ✅ | baris mengetik `$$` tak bocor |
| c | — | ✅ | ✅ | warna katex mengikuti var(--warning) |
| d | ✅ | ✅ | ✅ | semua bersamaan |

### 5) Stabilitas dipenggaruh salin

Tombol salin (Excel/MD) di pojokan tabel hanya boleh mengambil tabel,
bukan teks di luar. Penggaris akalnya 2.9 → nilai akhir:
$k = 2.9\,k_1 + 2.6\,k_2$, dengan $k_{ 2.6 }$.
