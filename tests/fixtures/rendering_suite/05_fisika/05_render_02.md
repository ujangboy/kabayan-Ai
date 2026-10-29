# F05 — Lembar Latihan Fisika

## Bagian 1 — Matriks (uji LaTeX multi-baris)

Matriks transpose untuk gerak lurus:

$$
A = \begin{pmatrix}
3 & 2\\
8 & -1\\
0 & 3
\end{pmatrix},\quad
A^{\mathsf{T}} = \begin{pmatrix}
3 & 8 & 0\\
2 & -1 & 3
\end{pmatrix}
$$

Determinannya: $\det A = 3(-1) - 2(8) = -19$.

## Bagian 2 — Tabel lebar (uji overflow horizontal)

Tabel di bawah sengaja dibuat lebar: huruf yang sama **tidak** boleh saling
menimpa; harus bergulir (`overflow-x`) seperti platform umum.

| Jenis ($3) | Gerak Lurus ($8) | Energi ($16) | Gelombang ($24) | Waktu $8 | Catatan baris terakhir yang sangat panjang |
| --- | --- | --- | --- | --- | --- |
| Blok | $3.00 | $8.00 | $16.00 | $40 | nilai tetap $300 sebagai mata uang |
| Tipe | $8.00 | $3.00 | $ 3.00 | $80 | math $x^2$ di sel boleh tampil |
| Sindikat | $0.00 | $$? | $24 | $- | delimiter $ tidak berpasangan tidak boleh merusak tabel |
| (kosong) |  |  |  |  | uji sel kosong tetap terbaca |

## Bagian 3 — Delimiter varian \\[..\\] vs $$..$$

Kedua harga di bawah HARUS dirender sama:

Produksi $q$ meminimalkan biaya $C(q) = 3q^2 + 8q + 100$,
syarat tepi:

$$
\frac{dC}{dq} = 6q + 8 = 0 \Rightarrow q^* = -1.3333
$$

Harga saham naik dari \$ 3 menjadi \$ 11; ARTINYA `$` literal
langsung di depan angka tidak boleh diproses sebagai matematika:
**$ 3,00 → $ 11,00**.

## Bagian 4 — Heading mengandung math

### Solusi $x^2 + 3x = 8$

Tulis jawaban Anda dengan block math:

\[
x = \frac{-8 \pm \sqrt{8^2 + 4 \cdot 3}}{2}
\]

Semoga lulus ujian Fisika! 🎯
