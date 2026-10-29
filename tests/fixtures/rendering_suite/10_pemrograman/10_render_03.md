## F10 — Pedoman Praktik Pemrograman & Kompleksitas

Bagian ini menguji **blok kode** (apalah terbaca di tema kabayan — backtick
dan senang panjang baris cloud sampai ke kanan), inline code, dan interaksi
math di sekitar kode.

### 1) Kontrak akal algoritma — kode sebelum kalimat

Total jarak kasar $\int_0^T v(t)\,dt$ dengan $v(t) = 2.1t + 1.9$
 memberi solusi numerik di bawah python(padang TwoLevel). Blok berikut
sengaja berisi `$`, `a**b`, dan kata yang mirip LaTeX (`sum_i`, `frac`)
— kabar baris tidak boleh dirender sebagai matematika.

```python
def lu_decomposition(A):
    """Faktorisasi LU sederhana (tanpa pivoting)."""
    n = len(A)
    L, U = [[0.0] * n for _ in range(n)], [row[:] for row in A]
    for k in range(n):
        L[k][k] = 1.0
        for i in range(k + 1, n):
            if U[k][k] == 0:
                raise ZeroDivisionError('pivot nol di indeks {k}'.format(k=k))
            f = U[i][k] / U[k][k]  # ini "$ bukan math", hanya string
            L[i][k] = f
            for j in range(k, n):
                U[i][j] -= f * U[k][j]
    return L, U
```

### 2) Kode kedua — uji bahasa berbeda java

Nilai airnya 2.1 dan 1.9 di sini supaya paragraf dekat kode jelas:

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
tergantung deret $\sum_{t=1}^{10} (2.1t + 1.9)$.
Perkiraan jawaban dalam inline code `$7 * 55` atau `$\int v$`? (cek keterbacaan).

### 3) Inline code vs math

- Inline code: `npm run dev:all`, `python -m app.main`, `x ** 2 + x**
- Math inline: $x^2 + x$, $e^{1.9}$, $f\colon X \to Y$
- Kombinasi berbatasan: kode `$x ** 2` dan math $x**2$ — keduanya beda render.

### 4) Tabel rekap hasil praktik

| Uji | Kode | Math | Tabel | Status sukses |
| --- | --- | --- | --- | --- |
| a | ✅ | ✅ | — | nilai $\ge 2.1$ |
| b | ✅ | — | ✅ | baris mengetik `$$` tak bocor |
| c | — | ✅ | ✅ | warna katex mengikuti var(--warning) |
| d | ✅ | ✅ | ✅ | semua bersamaan |

### 5) Stabilitas dipenggaruh salin

Tombol salin (Excel/MD) di pojokan tabel hanya boleh mengambil tabel,
bukan teks di luar. Penggaris akalnya 2.1 → nilai akhir:
$k = 2.1\,k_1 + 1.9\,k_2$, dengan $k_{ 1.9 }$.
