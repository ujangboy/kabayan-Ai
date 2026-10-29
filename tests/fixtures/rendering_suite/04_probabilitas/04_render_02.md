# F04 — Lembar Latihan Probabilitas

## Bagian 1 — Matriks (uji LaTeX multi-baris)

Matriks transpose untuk jadwal acak:

$$
A = \begin{pmatrix}
9 & 2\\
8 & -1\\
0 & 3
\end{pmatrix},\quad
A^{\mathsf{T}} = \begin{pmatrix}
9 & 8 & 0\\
2 & -1 & 3
\end{pmatrix}
$$

Determinannya: $\det A = 9(-1) - 2(8) = -25$.

## Bagian 2 — Tabel lebar (uji overflow horizontal)

Tabel di bawah sengaja dibuat lebar: huruf yang sama **tidak** boleh saling
menimpa; harus bergulir (`overflow-x`) seperti platform umum.

| Jenis ($9) | Jadwal Acak ($8) | Bayes ($16) | Variabel Acak ($24) | Waktu $8 | Catatan baris terakhir yang sangat panjang |
| --- | --- | --- | --- | --- | --- |
| Blok | $9.00 | $8.00 | $16.00 | $40 | nilai tetap $900 sebagai mata uang |
| Tipe | $8.00 | $9.00 | $ 9.00 | $80 | math $x^2$ di sel boleh tampil |
| Sindikat | $0.00 | $$? | $72 | $- | delimiter $ tidak berpasangan tidak boleh merusak tabel |
| (kosong) |  |  |  |  | uji sel kosong tetap terbaca |

## Bagian 3 — Delimiter varian \\[..\\] vs $$..$$

Kedua harga di bawah HARUS dirender sama:

Produksi $q$ meminimalkan biaya $C(q) = 9q^2 + 8q + 100$,
syarat tepi:

$$
\frac{dC}{dq} = 18q + 8 = 0 \Rightarrow q^* = -0.4444
$$

Harga saham naik dari \$ 9 menjadi \$ 17; ARTINYA `$` literal
langsung di depan angka tidak boleh diproses sebagai matematika:
**$ 9,00 → $ 17,00**.

## Bagian 4 — Heading mengandung math

### Solusi $x^2 + 9x = 8$

Tulis jawaban Anda dengan block math:

\[
x = \frac{-8 \pm \sqrt{8^2 + 4 \cdot 9}}{2}
\]

Semoga lulus ujian Probabilitas! 🎯
