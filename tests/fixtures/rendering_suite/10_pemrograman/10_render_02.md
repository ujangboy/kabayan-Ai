# F10 — Lembar Latihan Pemrograman & Kompleksitas

## Bagian 1 — Matriks (uji LaTeX multi-baris)

Matriks transpose untuk algoritma:

$$
A = \begin{pmatrix}
7 & 2\\
4 & -1\\
0 & 3
\end{pmatrix},\quad
A^{\mathsf{T}} = \begin{pmatrix}
7 & 4 & 0\\
2 & -1 & 3
\end{pmatrix}
$$

Determinannya: $\det A = 7(-1) - 2(4) = -15$.

## Bagian 2 — Tabel lebar (uji overflow horizontal)

Tabel di bawah sengaja dibuat lebar: huruf yang sama **tidak** boleh saling
menimpa; harus bergulir (`overflow-x`) seperti platform umum.

| Jenis ($7) | Algoritma ($4) | Situs Asimtotik ($8) | Struktur Data ($12) | Waktu $4 | Catatan baris terakhir yang sangat panjang |
| --- | --- | --- | --- | --- | --- |
| Blok | $7.00 | $4.00 | $8.00 | $20 | nilai tetap $700 sebagai mata uang |
| Tipe | $4.00 | $7.00 | $ 7.00 | $40 | math $x^2$ di sel boleh tampil |
| Sindikat | $0.00 | $$? | $28 | $- | delimiter $ tidak berpasangan tidak boleh merusak tabel |
| (kosong) |  |  |  |  | uji sel kosong tetap terbaca |

## Bagian 3 — Delimiter varian \\[..\\] vs $$..$$

Kedua harga di bawah HARUS dirender sama:

Produksi $q$ meminimalkan biaya $C(q) = 7q^2 + 4q + 100$,
syarat tepi:

$$
\frac{dC}{dq} = 14q + 4 = 0 \Rightarrow q^* = -0.2857
$$

Harga saham naik dari \$ 7 menjadi \$ 11; ARTINYA `$` literal
langsung di depan angka tidak boleh diproses sebagai matematika:
**$ 7,00 → $ 11,00**.

## Bagian 4 — Heading mengandung math

### Solusi $x^2 + 7x = 4$

Tulis jawaban Anda dengan block math:

\[
x = \frac{-4 \pm \sqrt{4^2 + 4 \cdot 7}}{2}
\]

Semoga lulus ujian Pemrograman & Kompleksitas! 🎯
