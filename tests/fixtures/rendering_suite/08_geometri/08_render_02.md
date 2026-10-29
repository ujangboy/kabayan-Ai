# F08 — Lembar Latihan Geometri

## Bagian 1 — Matriks (uji LaTeX multi-baris)

Matriks transpose untuk trigonometri:

$$
A = \begin{pmatrix}
9 & 2\\
6 & -1\\
0 & 3
\end{pmatrix},\quad
A^{\mathsf{T}} = \begin{pmatrix}
9 & 6 & 0\\
2 & -1 & 3
\end{pmatrix}
$$

Determinannya: $\det A = 9(-1) - 2(6) = -21$.

## Bagian 2 — Tabel lebar (uji overflow horizontal)

Tabel di bawah sengaja dibuat lebar: huruf yang sama **tidak** boleh saling
menimpa; harus bergulir (`overflow-x`) seperti platform umum.

| Jenis ($9) | Trigonometri ($6) | Koordinat ($12) | Lingkaran ($18) | Waktu $6 | Catatan baris terakhir yang sangat panjang |
| --- | --- | --- | --- | --- | --- |
| Blok | $9.00 | $6.00 | $12.00 | $30 | nilai tetap $900 sebagai mata uang |
| Tipe | $6.00 | $9.00 | $ 9.00 | $60 | math $x^2$ di sel boleh tampil |
| Sindikat | $0.00 | $$? | $54 | $- | delimiter $ tidak berpasangan tidak boleh merusak tabel |
| (kosong) |  |  |  |  | uji sel kosong tetap terbaca |

## Bagian 3 — Delimiter varian \\[..\\] vs $$..$$

Kedua harga di bawah HARUS dirender sama:

Produksi $q$ meminimalkan biaya $C(q) = 9q^2 + 6q + 100$,
syarat tepi:

$$
\frac{dC}{dq} = 18q + 6 = 0 \Rightarrow q^* = -0.3333
$$

Harga saham naik dari \$ 9 menjadi \$ 15; ARTINYA `$` literal
langsung di depan angka tidak boleh diproses sebagai matematika:
**$ 9,00 → $ 15,00**.

## Bagian 4 — Heading mengandung math

### Solusi $x^2 + 9x = 6$

Tulis jawaban Anda dengan block math:

\[
x = \frac{-6 \pm \sqrt{6^2 + 4 \cdot 9}}{2}
\]

Semoga lulus ujian Geometri! 🎯
