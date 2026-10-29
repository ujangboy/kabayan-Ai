# F03 — Lembar Latihan Statistika

## Bagian 1 — Matriks (uji LaTeX multi-baris)

Matriks transpose untuk mean:

$$
A = \begin{pmatrix}
6 & 2\\
2 & -1\\
0 & 3
\end{pmatrix},\quad
A^{\mathsf{T}} = \begin{pmatrix}
6 & 2 & 0\\
2 & -1 & 3
\end{pmatrix}
$$

Determinannya: $\det A = 6(-1) - 2(2) = -10$.

## Bagian 2 — Tabel lebar (uji overflow horizontal)

Tabel di bawah sengaja dibuat lebar: huruf yang sama **tidak** boleh saling
menimpa; harus bergulir (`overflow-x`) seperti platform umum.

| Jenis ($6) | Mean ($2) | Varians ($4) | Distribusi ($6) | Waktu $2 | Catatan baris terakhir yang sangat panjang |
| --- | --- | --- | --- | --- | --- |
| Blok | $6.00 | $2.00 | $4.00 | $10 | nilai tetap $600 sebagai mata uang |
| Tipe | $2.00 | $6.00 | $ 6.00 | $20 | math $x^2$ di sel boleh tampil |
| Sindikat | $0.00 | $$? | $12 | $- | delimiter $ tidak berpasangan tidak boleh merusak tabel |
| (kosong) |  |  |  |  | uji sel kosong tetap terbaca |

## Bagian 3 — Delimiter varian \\[..\\] vs $$..$$

Kedua harga di bawah HARUS dirender sama:

Produksi $q$ meminimalkan biaya $C(q) = 6q^2 + 2q + 100$,
syarat tepi:

$$
\frac{dC}{dq} = 12q + 2 = 0 \Rightarrow q^* = -0.1667
$$

Harga saham naik dari \$ 6 menjadi \$ 8; ARTINYA `$` literal
langsung di depan angka tidak boleh diproses sebagai matematika:
**$ 6,00 → $ 8,00**.

## Bagian 4 — Heading mengandung math

### Solusi $x^2 + 6x = 2$

Tulis jawaban Anda dengan block math:

\[
x = \frac{-2 \pm \sqrt{2^2 + 4 \cdot 6}}{2}
\]

Semoga lulus ujian Statistika! 🎯
