# F09 — Lembar Latihan Metode Numerik

## Bagian 1 — Matriks (uji LaTeX multi-baris)

Matriks transpose untuk iterasi:

$$
A = \begin{pmatrix}
4 & 2\\
9 & -1\\
0 & 3
\end{pmatrix},\quad
A^{\mathsf{T}} = \begin{pmatrix}
4 & 9 & 0\\
2 & -1 & 3
\end{pmatrix}
$$

Determinannya: $\det A = 4(-1) - 2(9) = -22$.

## Bagian 2 — Tabel lebar (uji overflow horizontal)

Tabel di bawah sengaja dibuat lebar: huruf yang sama **tidak** boleh saling
menimpa; harus bergulir (`overflow-x`) seperti platform umum.

| Jenis ($4) | Iterasi ($9) | Akar-Akar ($18) | Interpolasi ($27) | Waktu $9 | Catatan baris terakhir yang sangat panjang |
| --- | --- | --- | --- | --- | --- |
| Blok | $4.00 | $9.00 | $18.00 | $45 | nilai tetap $400 sebagai mata uang |
| Tipe | $9.00 | $4.00 | $ 4.00 | $90 | math $x^2$ di sel boleh tampil |
| Sindikat | $0.00 | $$? | $36 | $- | delimiter $ tidak berpasangan tidak boleh merusak tabel |
| (kosong) |  |  |  |  | uji sel kosong tetap terbaca |

## Bagian 3 — Delimiter varian \\[..\\] vs $$..$$

Kedua harga di bawah HARUS dirender sama:

Produksi $q$ meminimalkan biaya $C(q) = 4q^2 + 9q + 100$,
syarat tepi:

$$
\frac{dC}{dq} = 8q + 9 = 0 \Rightarrow q^* = -1.1250
$$

Harga saham naik dari \$ 4 menjadi \$ 13; ARTINYA `$` literal
langsung di depan angka tidak boleh diproses sebagai matematika:
**$ 4,00 → $ 13,00**.

## Bagian 4 — Heading mengandung math

### Solusi $x^2 + 4x = 9$

Tulis jawaban Anda dengan block math:

\[
x = \frac{-9 \pm \sqrt{9^2 + 4 \cdot 4}}{2}
\]

Semoga lulus ujian Metode Numerik! 🎯
