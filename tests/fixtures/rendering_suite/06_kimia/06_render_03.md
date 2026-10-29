## F06 — Pedoman Praktik Kimia

Bagian ini menguji **blok kode** (apalah terbaca di tema kabayan — backtick
dan senang panjang baris cloud sampai ke kanan), inline code, dan interaksi
math di sekitar kode.

### 1) Kontrak akal stoikiometri — kode sebelum kalimat

Total jarak kasar $\int_0^T v(t)\,dt$ dengan $v(t) = 2.2t + 2.5$
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

### 2) Kode kedua — uji bahasa berbeda c

Nilai airnya 2.2 dan 2.5 di sini supaya paragraf dekat kode jelas:

```c
#include <stdio.h>

double f(double x) { return x * x - 4.0; }

int main(void) {
  double a = 1.0, b = 3.0;
  for (int i = 0; i < 25; i++) {
    double m = 0.5 * (a + b);  /* bisection */
    if (f(m) * f(a) < 0) b = m; else a = m;
  }
  printf("akar ~ %.10f\n", a);
  return 0;
}
```

Prompt: hitung total biaya bila harga net per satuan **$7** dan jarak
tergantung deret $\sum_{t=1}^{10} (2.2t + 2.5)$.
Perkiraan jawaban dalam inline code `$7 * 55` atau `$\int v$`? (cek keterbacaan).

### 3) Inline code vs math

- Inline code: `npm run dev:all`, `python -m app.main`, `x ** 2 + x**
- Math inline: $x^2 + x$, $e^{2.5}$, $f\colon X \to Y$
- Kombinasi berbatasan: kode `$x ** 2` dan math $x**2$ — keduanya beda render.

### 4) Tabel rekap hasil praktik

| Uji | Kode | Math | Tabel | Status sukses |
| --- | --- | --- | --- | --- |
| a | ✅ | ✅ | — | nilai $\ge 2.2$ |
| b | ✅ | — | ✅ | baris mengetik `$$` tak bocor |
| c | — | ✅ | ✅ | warna katex mengikuti var(--warning) |
| d | ✅ | ✅ | ✅ | semua bersamaan |

### 5) Stabilitas dipenggaruh salin

Tombol salin (Excel/MD) di pojokan tabel hanya boleh mengambil tabel,
bukan teks di luar. Penggaris akalnya 2.2 → nilai akhir:
$k = 2.2\,k_1 + 2.5\,k_2$, dengan $k_{ 2.5 }$.
