## F04 — Pedoman Praktik Probabilitas

Bagian ini menguji **blok kode** (apalah terbaca di tema kabayan — backtick
dan senang panjang baris cloud sampai ke kanan), inline code, dan interaksi
math di sekitar kode.

### 1) Kontrak akal jadwal acak — kode sebelum kalimat

Total jarak kasar $\int_0^T v(t)\,dt$ dengan $v(t) = 2.6t + 1.9$
 memberi solusi numerik di bawah bash(padang TwoLevel). Blok berikut
sengaja berisi `$`, `a**b`, dan kata yang mirip LaTeX (`sum_i`, `frac`)
— kabar baris tidak boleh dirender sebagai matematika.

```bash
#!/usr/bin/env bash
set -euo pipefail
for berkas in materi_*.pdf; do
  python -m app.parsers.pdf "$berkas" --out "text_cache/${berkas%.pdf}.txt"
done
echo "selesai: $?"
```

### 2) Kode kedua — uji bahasa berbeda java

Nilai airnya 2.6 dan 1.9 di sini supaya paragraf dekat kode jelas:

```java
public class Turunan {
  static double maju(double[] y, double[] x, int i) {
    return (y[i + 1] - y[i]) / (x[i + 1] - x[i]);
  }
  public static void main(String[] args) {
    double[] x = {0.0, 1.0, 2.5};
    double[] y = {1.0, 2.718, 12.182};
    System.out.println(maju(y, x, 0));
  }
}
```

Prompt: hitung total biaya bila harga net per satuan **$7** dan jarak
tergantung deret $\sum_{t=1}^{10} (2.6t + 1.9)$.
Perkiraan jawaban dalam inline code `$7 * 55` atau `$\int v$`? (cek keterbacaan).

### 3) Inline code vs math

- Inline code: `npm run dev:all`, `python -m app.main`, `x ** 2 + x**
- Math inline: $x^2 + x$, $e^{1.9}$, $f\colon X \to Y$
- Kombinasi berbatasan: kode `$x ** 2` dan math $x**2$ — keduanya beda render.

### 4) Tabel rekap hasil praktik

| Uji | Kode | Math | Tabel | Status sukses |
| --- | --- | --- | --- | --- |
| a | ✅ | ✅ | — | nilai $\ge 2.6$ |
| b | ✅ | — | ✅ | baris mengetik `$$` tak bocor |
| c | — | ✅ | ✅ | warna katex mengikuti var(--warning) |
| d | ✅ | ✅ | ✅ | semua bersamaan |

### 5) Stabilitas dipenggaruh salin

Tombol salin (Excel/MD) di pojokan tabel hanya boleh mengambil tabel,
bukan teks di luar. Penggaris akalnya 2.6 → nilai akhir:
$k = 2.6\,k_1 + 1.9\,k_2$, dengan $k_{ 1.9 }$.
