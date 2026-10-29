# F07 — Lembar Latihan Teori Bilangan

## Bagian 1 — Matriks (uji LaTeX multi-baris)

Matriks transpose untuk divisibilitas:

$$
A = \begin{pmatrix}
9 & 2\\
9 & -1\\
0 & 3
\end{pmatrix},\quad
A^{\mathsf{T}} = \begin{pmatrix}
9 & 9 & 0\\
2 & -1 & 3
\end{pmatrix}
$$

Determinannya: $\det A = 9(-1) - 2(9) = -27$.

## Bagian 2 — Tabel lebar (uji overflow horizontal)

Tabel di bawah sengaja dibuat lebar: huruf yang sama **tidak** boleh saling
menimpa; harus bergulir (`overflow-x`) seperti platform umum.

| Jenis ($9) | Divisibilitas ($9) | Modular ($18) | Prima ($27) | Waktu $9 | Catatan baris terakhir yang sangat panjang |
| --- | --- | --- | --- | --- | --- |
| Blok | $9.00 | $9.00 | $18.00 | $45 | nilai tetap $900 sebagai mata uang |
| Tipe | $9.00 | $9.00 | $ 9.00 | $90 | math $x^2$ di sel boleh tampil |
| Sindikat | $0.00 | $$? | $81 | $- | delimiter $ tidak berpasangan tidak boleh merusak tabel |
| (kosong) |  |  |  |  | uji sel kosong tetap terbaca |

## Bagian 3 — Delimiter varian \\[..\\] vs $$..$$

Kedua harga di bawah HARUS dirender sama:

Produksi $q$ meminimalkan biaya $C(q) = 9q^2 + 9q + 100$,
syarat tepi:

$$
\frac{dC}{dq} = 18q + 9 = 0 \Rightarrow q^* = -0.5000
$$

Harga saham naik dari \$ 9 menjadi \$ 18; ARTINYA `$` literal
langsung di depan angka tidak boleh diproses sebagai matematika:
**$ 9,00 → $ 18,00**.

## Bagian 4 — Heading mengandung math

### Solusi $x^2 + 9x = 9$

Tulis jawaban Anda dengan block math:

\[
x = \frac{-9 \pm \sqrt{9^2 + 4 \cdot 9}}{2}
\]

Semoga lulus ujian Teori Bilangan! 🎯
