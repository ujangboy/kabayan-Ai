# F02 — Lembar Latihan Kalkulus

## Bagian 1 — Matriks (uji LaTeX multi-baris)

Matriks transpose untuk turunan:

$$
A = \begin{pmatrix}
8 & 2\\
6 & -1\\
0 & 3
\end{pmatrix},\quad
A^{\mathsf{T}} = \begin{pmatrix}
8 & 6 & 0\\
2 & -1 & 3
\end{pmatrix}
$$

Determinannya: $\det A = 8(-1) - 2(6) = -20$.

## Bagian 2 — Tabel lebar (uji overflow horizontal)

Tabel di bawah sengaja dibuat lebar: huruf yang sama **tidak** boleh saling
menimpa; harus bergulir (`overflow-x`) seperti platform umum.

| Jenis ($8) | Turunan ($6) | Integral ($12) | Limit ($18) | Waktu $6 | Catatan baris terakhir yang sangat panjang |
| --- | --- | --- | --- | --- | --- |
| Blok | $8.00 | $6.00 | $12.00 | $30 | nilai tetap $800 sebagai mata uang |
| Tipe | $6.00 | $8.00 | $ 8.00 | $60 | math $x^2$ di sel boleh tampil |
| Sindikat | $0.00 | $$? | $48 | $- | delimiter $ tidak berpasangan tidak boleh merusak tabel |
| (kosong) |  |  |  |  | uji sel kosong tetap terbaca |

## Bagian 3 — Delimiter varian \\[..\\] vs $$..$$

Kedua harga di bawah HARUS dirender sama:

Produksi $q$ meminimalkan biaya $C(q) = 8q^2 + 6q + 100$,
syarat tepi:

$$
\frac{dC}{dq} = 16q + 6 = 0 \Rightarrow q^* = -0.3750
$$

Harga saham naik dari \$ 8 menjadi \$ 14; ARTINYA `$` literal
langsung di depan angka tidak boleh diproses sebagai matematika:
**$ 8,00 → $ 14,00**.

## Bagian 4 — Heading mengandung math

### Solusi $x^2 + 8x = 6$

Tulis jawaban Anda dengan block math:

\[
x = \frac{-6 \pm \sqrt{6^2 + 4 \cdot 8}}{2}
\]

Semoga lulus ujian Kalkulus! 🎯
