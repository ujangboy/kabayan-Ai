## F07 — Pedoman Praktik Teori Bilangan

Bagian ini menguji **blok kode** (apalah terbaca di tema kabayan — backtick
dan senang panjang baris cloud sampai ke kanan), inline code, dan interaksi
math di sekitar kode.

### 1) Kontrak akal divisibilitas — kode sebelum kalimat

Total jarak kasar $\int_0^T v(t)\,dt$ dengan $v(t) = 1.1t + 1.7$
 memberi solusi numerik di bawah java(padang TwoLevel). Blok berikut
sengaja berisi `$`, `a**b`, dan kata yang mirip LaTeX (`sum_i`, `frac`)
— kabar baris tidak boleh dirender sebagai matematika.

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

### 2) Kode kedua — uji bahasa berbeda javascript

Nilai airnya 1.1 dan 1.7 di sini supaya paragraf dekat kode jelas:

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
tergantung deret $\sum_{t=1}^{10} (1.1t + 1.7)$.
Perkiraan jawaban dalam inline code `$7 * 55` atau `$\int v$`? (cek keterbacaan).

### 3) Inline code vs math

- Inline code: `npm run dev:all`, `python -m app.main`, `x ** 2 + x**
- Math inline: $x^2 + x$, $e^{1.7}$, $f\colon X \to Y$
- Kombinasi berbatasan: kode `$x ** 2` dan math $x**2$ — keduanya beda render.

### 4) Tabel rekap hasil praktik

| Uji | Kode | Math | Tabel | Status sukses |
| --- | --- | --- | --- | --- |
| a | ✅ | ✅ | — | nilai $\ge 1.1$ |
| b | ✅ | — | ✅ | baris mengetik `$$` tak bocor |
| c | — | ✅ | ✅ | warna katex mengikuti var(--warning) |
| d | ✅ | ✅ | ✅ | semua bersamaan |

### 5) Stabilitas dipenggaruh salin

Tombol salin (Excel/MD) di pojokan tabel hanya boleh mengambil tabel,
bukan teks di luar. Penggaris akalnya 1.1 → nilai akhir:
$k = 1.1\,k_1 + 1.7\,k_2$, dengan $k_{ 1.7 }$.
