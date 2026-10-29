## F01 — Catatan Matriks (Aljabar Linear)

Ringkasan materi **Aljabar Linear** tentang matriks, vektor, dan eigen
untuk level *mahasiswa baru*. File ini menguji LaTeX **inline**, **block**,
tabel GFM, dan apakah tabel tetap terbaca.

### Definisi inti

Didefinisikan fungsi $f(x) = 3x^2 - 8x + \pi$ dengan domain real.
Relasi penting:

\[
E[f(X)] = \mu, \qquad \operatorname{Var}(f(X)) = \sigma^2
\]

Gradien lintasan diberikan oleh \(\nabla f = \left( \frac{\partial f}{\partial x}, \frac{\partial f}{\partial y} \right)\).
Kasus khusus ketika $\alpha \to 0$:

\[
\lim_{\alpha \to 0^+} \frac{f(\alpha) - f(0)}{\alpha} = f'(0)
\]

### Tabel ringkasan (dengan math di sel)

| Simbol | Arti | Nilai contoh | Rumus |
| --- | --- | --- | --- |
| $\mu$ | rata-rata | 8.84 | $\mu = \frac{1}{n}\sum x_i$ |
| $\sigma^2$ | variansi | 3.58 | $\sigma^2 = \frac{1}{n}\sum (x_i-\mu)^2$ |
| $R^2$ | kecocokan | 0.80 | $R^2 = 1 - \frac{SS_{res}}{SS_{tot}}$ |
| $p$ | peluang keberhasilan | 0.15 | $P(X=k) = \binom{n}{k}p^k(1-p)^{n-k}$ |
|  | (sel kosong) |  | uji tabel tetap rapi |
| $\$$ | simbol dollar literal | harga ${_3}9 | bukan math |

### Poin penting

1. Rumus inline $\alpha + \beta\gamma$ harus tetap miring/seragam.
2. Heading dengan **bold** bocor $x^{ 3}$ normal.
3. Baris panjang tabel harus bisa scroll horizontal tanpa merusak kolom.

> Catatan: file ini bahan uji rendering Kabayan Pintar — lihat
> `tests/fixtures/rendering_suite/README.md` untuk memakainya.
