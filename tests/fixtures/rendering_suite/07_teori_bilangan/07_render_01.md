## F07 — Catatan Divisibilitas (Teori Bilangan)

Ringkasan materi **Teori Bilangan** tentang divisibilitas, modular, dan prima
untuk level *mahasiswa baru*. File ini menguji LaTeX **inline**, **block**,
tabel GFM, dan apakah tabel tetap terbaca.

### Definisi inti

Didefinisikan fungsi $f(x) = 8x^2 - 9x + \pi$ dengan domain real.
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
| $\mu$ | rata-rata | 2.94 | $\mu = \frac{1}{n}\sum x_i$ |
| $\sigma^2$ | variansi | 1.08 | $\sigma^2 = \frac{1}{n}\sum (x_i-\mu)^2$ |
| $R^2$ | kecocokan | 0.52 | $R^2 = 1 - \frac{SS_{res}}{SS_{tot}}$ |
| $p$ | peluang keberhasilan | 0.35 | $P(X=k) = \binom{n}{k}p^k(1-p)^{n-k}$ |
|  | (sel kosong) |  | uji tabel tetap rapi |
| $\$$ | simbol dollar literal | harga ${_8}9 | bukan math |

### Poin penting

1. Rumus inline $\alpha + \beta\gamma$ harus tetap miring/seragam.
2. Heading dengan **bold** bocor $x^{ 8}$ normal.
3. Baris panjang tabel harus bisa scroll horizontal tanpa merusak kolom.

> Catatan: file ini bahan uji rendering Kabayan Pintar — lihat
> `tests/fixtures/rendering_suite/README.md` untuk memakainya.
