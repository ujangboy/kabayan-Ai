#!/usr/bin/env python3
"""Generator fixture uji rendering untuk Kabayan Pintar.

Menghasilkan 10 folder, masing-masing 3 file markdown berisi:
matematika (LaTeX inline + block + varian \\[..\\] / \\(..\\)),
tabel GFM (sederhana, lebar, math-di-sel), dan kode (python/js/java/sql/bash/c).

Konten sengaja memakai kasus tepi yang rawan bug:
  - $ sebagai simbol mata uang vs matematika
  - math block di tengah tabel & di heading
  - delimiter tidak berpasangan (unpaired $$) → uji sanitizeUnpairedDelimiters
  - kode berisi dollar/underscore → tidak boleh ikut dirender
  - tabel lebar (uji overflow-x) dan sel kosong

Pemakaian:
  python scripts/testing/generate_rendering_fixtures.py [--seed 2026] [--out DIR]

Output default: tests/fixtures/rendering_suite/<NN filosofofit tema>/
"""

from __future__ import annotations

import argparse
import random
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

TEMA = [
    ("01_aljabar_linear", "Aljabar Linear", ["matriks", "vektor", "eigen"]),
    ("02_kalkulus", "Kalkulus", ["turunan", "integral", "limit"]),
    ("03_statistika", "Statistika", ["mean", "varians", "distribusi"]),
    ("04_probabilitas", "Probabilitas", ["jadwal acak", "bayes", "variabel acak"]),
    ("05_fisika", "Fisika", ["gerak lurus", "energi", "gelombang"]),
    ("06_kimia", "Kimia", ["stoikiometri", "reaksi", "termodinamika kimia"]),
    ("07_teori_bilangan", "Teori Bilangan", ["divisibilitas", "modular", "prima"]),
    ("08_geometri", "Geometri", ["trigonometri", "koordinat", "lingkaran"]),
    ("09_metode_numerik", "Metode Numerik", ["iterasi", "akar-akar", "interpolasi"]),
    ("10_pemrograman", "Pemrograman & Kompleksitas", ["algoritma", "situs asimtotik", "struktur data"]),
]

BAHASA_KODE = ["python", "javascript", "java", "sql", "bash", "c"]

KODE_POTONGAN = {
    "python": (
        "def lu_decomposition(A):\n"
        '    """Faktorisasi LU sederhana (tanpa pivoting)."""\n'
        "    n = len(A)\n"
        "    L, U = [[0.0] * n for _ in range(n)], [row[:] for row in A]\n"
        "    for k in range(n):\n"
        "        L[k][k] = 1.0\n"
        "        for i in range(k + 1, n):\n"
        "            if U[k][k] == 0:\n"
        "                raise ZeroDivisionError('pivot nol di indeks {k}'.format(k=k))\n"
        '            f = U[i][k] / U[k][k]  # ini "$ bukan math", hanya string\n'
        "            L[i][k] = f\n"
        "            for j in range(k, n):\n"
        "                U[i][j] -= f * U[k][j]\n"
        "    return L, U\n"
    ),
    "javascript": (
        "function nilaiEkspektasi(nilai, prob) {\n"
        "  let total = 0;\n"
        "  for (let i = 0; i < nilai.length; i++) {\n"
        "    total += nilai[i] * prob[i]; // sum_ i p_i x_i\n"
        "  }\n"
        "  return total;\n"
        "}\n"
        "console.log(nilaiEkspektasi([1, 2, 3], [0.2, 0.5, 0.3])); // 2.1\n"
    ),
    "java": (
        "public class Turunan {\n"
        "  static double maju(double[] y, double[] x, int i) {\n"
        "    return (y[i + 1] - y[i]) / (x[i + 1] - x[i]);\n"
        "  }\n"
        "  public static void main(String[] args) {\n"
        "    double[] x = {0.0, 1.0, 2.5};\n"
        "    double[] y = {1.0, 2.718, 12.182};\n"
        "    System.out.println(maju(y, x, 0));\n"
        "  }\n"
        "}\n"
    ),
    "sql": (
        "-- Nilai rata-rata catur per kelas/char_data dimainkan\n"
        "SELECT k.nama, AVG(n.skor) AS mean_skor, COUNT(*) AS n\n"
        "FROM nilai_ujian n\n"
        "JOIN siswa s ON s.id = n.siswa_id\n"
        "JOIN kelas k ON k.id = s.kelas_id\n"
        "WHERE n.skor IS NOT NULL\n"
        "GROUP BY k.nama\n"
        "HAVING COUNT(*) >= 5\n"
        "ORDER BY mean_skor DESC;\n"
    ),
    "bash": (
        "#!/usr/bin/env bash\n"
        "set -euo pipefail\n"
        "for berkas in materi_*.pdf; do\n"
        "  python -m app.parsers.pdf \"$berkas\" --out \"text_cache/${berkas%.pdf}.txt\"\n"
        "done\n"
        'echo "selesai: $?"\n'
    ),
    "c": (
        "#include <stdio.h>\n"
        "\n"
        "double f(double x) { return x * x - 4.0; }\n"
        "\n"
        "int main(void) {\n"
        "  double a = 1.0, b = 3.0;\n"
        "  for (int i = 0; i < 25; i++) {\n"
        '    double m = 0.5 * (a + b);  /* bisection */\n'
        "    if (f(m) * f(a) < 0) b = m; else a = m;\n"
        "  }\n"
        "  printf(\"akar ~ %.10f\\n\", a);\n"
        "  return 0;\n"
        "}\n"
    ),
}


def fmt_angka(x: float) -> str:
    return f"{x:.2f}".rstrip("0").rstrip(".")


def tabel(mat: str, nama: str, baris: int, kolom: list[str], fill):
    kepala = "| " + " | ".join(kolom) + " |"
    pisah = "|" + "|".join("---" * 1 for _ in kolom) + "|"
    pisah = "| " + " | ".join("---" for _ in kolom) + " |"
    isi = []
    for i in range(baris):
        isi.append("| " + " | ".join(fill(i, j) for j, _ in enumerate(kolom)) + " |")
    return f"**{nama}**\n\n{kepala}\n{pisah}\n" + "\n".join(isi)


def buat_file_1(direktori, idx, tema_nama, konsep, rng):
    """File A: paduan konsep — math inline/block + tabel sederhana dengan math."""
    a, b = rng.randint(2, 9), rng.randint(3, 12)
    p = rng.choice(["0.15", "0.35", "0.6", "0.75"])
    judul = f"F{idx:02d} — Catatan {konsep[0].title()} ({tema_nama})"
    isi = f"""## {judul}

Ringkasan materi **{tema_nama}** tentang {konsep[0]}, {konsep[1]}, dan {konsep[2]}
untuk level *mahasiswa baru*. File ini menguji LaTeX **inline**, **block**,
tabel GFM, dan apakah tabel tetap terbaca.

### Definisi inti

Didefinisikan fungsi $f(x) = {a}x^2 - {b}x + \\pi$ dengan domain real.
Relasi penting:

\\[
E[f(X)] = \\mu, \\qquad \\operatorname{{Var}}(f(X)) = \\sigma^2
\\]

Gradien lintasan diberikan oleh \\(\\nabla f = \\left( \\frac{{\\partial f}}{{\\partial x}}, \\frac{{\\partial f}}{{\\partial y}} \\right)\\).
Kasus khusus ketika $\\alpha \\to 0$:

\\[
\\lim_{{\\alpha \\to 0^+}} \\frac{{f(\\alpha) - f(0)}}{{\\alpha}} = f'(0)
\\]

### Tabel ringkasan (dengan math di sel)

| Simbol | Arti | Nilai contoh | Rumus |
| --- | --- | --- | --- |
| $\\mu$ | rata-rata | {fmt_angka(rng.uniform(0, 10))} | $\\mu = \\frac{{1}}{{n}}\\sum x_i$ |
| $\\sigma^2$ | variansi | {fmt_angka(rng.uniform(0, 4))} | $\\sigma^2 = \\frac{{1}}{{n}}\\sum (x_i-\\mu)^2$ |
| $R^2$ | kecocokan | {rng.uniform(0.5, 0.99):.2f} | $R^2 = 1 - \\frac{{SS_{{res}}}}{{SS_{{tot}}}}$ |
| $p$ | peluang keberhasilan | {p} | $P(X=k) = \\binom{{n}}{{k}}p^k(1-p)^{{n-k}}$ |
|  | (sel kosong) |  | uji tabel tetap rapi |
| $\\$$ | simbol dollar literal | harga ${{_{a}}}9 | bukan math |

### Poin penting

1. Rumus inline $\\alpha + \\beta\\gamma$ harus tetap miring/seragam.
2. Heading dengan **bold** bocor $x^{{ {a}}}$ normal.
3. Baris panjang tabel harus bisa scroll horizontal tanpa merusak kolom.

> Catatan: file ini bahan uji rendering Kabayan Pintar — lihat
> `tests/fixtures/rendering_suite/README.md` untuk memakainya.
"""
    return isi


def buat_file_2(direktori, idx, tema_nama, konsep, rng):
    """File B: lembar soal — tabel lebar, matriks, delimiter varian, dollar uang."""
    n = rng.randint(3, 5)
    m1 = rng.randint(2, 9)
    m2 = rng.randint(2, 9)
    ket = ["Blok", "Tipe", "Sindikat", "Intervensi", "Kelompok", "Anak-Rangkap"]
    isi = f"""# F{idx:02d} — Lembar Latihan {tema_nama}

## Bagian 1 — Matriks (uji LaTeX multi-baris)

Matriks transpose untuk {konsep[0]}:

$$
A = \\begin{{pmatrix}}\n{m1} & 2\\\\\n{m2} & -1\\\\\n0 & 3\n\\end{{pmatrix}},\\quad
A^{{\\mathsf{{T}}}} = \\begin{{pmatrix}}\n{m1} & {m2} & 0\\\\\n2 & -1 & 3\n\\end{{pmatrix}}
$$

Determinannya: $\\det A = {m1}(-1) - 2({m2}) = {-(m1 + 2 * m2)}$.

## Bagian 2 — Tabel lebar (uji overflow horizontal)

Tabel di bawah sengaja dibuat lebar: huruf yang sama **tidak** boleh saling
menimpa; harus bergulir (`overflow-x`) seperti platform umum.

| Jenis (${m1}) | {konsep[0].title()} (${m2}) | {konsep[1].title()} (${m2 * 2}) | {konsep[2].title()} (${m2 * 3}) | Waktu ${m2} | Catatan baris terakhir yang sangat panjang |
| --- | --- | --- | --- | --- | --- |
| {ket[0]} | ${m1}.00 | ${m2}.00 | ${m2 * 2}.00 | ${m2 * 5} | nilai tetap ${m1}00 sebagai mata uang |
| {ket[1]} | ${m2}.00 | ${m1}.00 | $ {m1}.00 | ${m2}0 | math $x^2$ di sel boleh tampil |
| {ket[2]} | $0.00 | $$? | ${m1 * m2} | $- | delimiter $ tidak berpasangan tidak boleh merusak tabel |
| (kosong) |  |  |  |  | uji sel kosong tetap terbaca |

## Bagian 3 — Delimiter varian \\\\[..\\\\] vs $$..$$

Kedua harga di bawah HARUS dirender sama:

Produksi $q$ meminimalkan biaya $C(q) = {m1}q^2 + {m2}q + 100$,
syarat tepi:

$$
\\frac{{dC}}{{dq}} = {2 * m1}q + {m2} = 0 \\Rightarrow q^* = {-m2 / (2 * m1):.4f}
$$

Harga saham naik dari \\$ {m1} menjadi \\$ {m1 + m2}; ARTINYA `$` literal
langsung di depan angka tidak boleh diproses sebagai matematika:
**$ {m1},00 → $ {m1 + m2},00**.

## Bagian 4 — Heading mengandung math

### Solusi $x^{2} + {m1}x = {m2}$

Tulis jawaban Anda dengan block math:

\\[
x = \\frac{{{-m2} \\pm \\sqrt{{{m2}^2 + 4 \\cdot {m1}}}}}{{2}}
\\]

Semoga lulus ujian {tema_nama}! 🎯
"""
    return isi


def buat_file_3(direktori, idx, tema_nama, konsep, rng):
    """File C: halaman pedoman — blok kode 3 bahasa, inline code, dollar, math dekat kode."""
    lang1, lang2 = rng.sample(BAHASA_KODE, 2)
    s1 = rng.uniform(0.4, 3.0)
    s2 = rng.uniform(0.4, 3.0)
    isi = f"""## F{idx:02d} — Pedoman Praktik {tema_nama}

Bagian ini menguji **blok kode** (apalah terbaca di tema kabayan — backtick
dan senang panjang baris cloud sampai ke kanan), inline code, dan interaksi
math di sekitar kode.

### 1) Kontrak akal {konsep[0]} — kode sebelum kalimat

Total jarak kasar $\\int_0^T v(t)\\,dt$ dengan $v(t) = {s1:.1f}t + {s2:.1f}$
 memberi solusi numerik di bawah {lang1}(padang TwoLevel). Blok berikut
sengaja berisi `$`, `a**b`, dan kata yang mirip LaTeX (`sum_i`, `frac`)
— kabar baris tidak boleh dirender sebagai matematika.

```{lang1}
{ KODE_POTONGAN[lang1].strip() }
```

### 2) Kode kedua — uji bahasa berbeda {lang2}

Nilai airnya {s1:.1f} dan {s2:.1f} di sini supaya paragraf dekat kode jelas:

```{lang2}
{ KODE_POTONGAN[lang2].strip() }
```

Prompt: hitung total biaya bila harga net per satuan **$7** dan jarak
tergantung deret $\\sum_{{t=1}}^{{10}} ({s1:.1f}t + {s2:.1f})$.
Perkiraan jawaban dalam inline code `$7 * 55` atau `$\\int v$`? (cek keterbacaan).

### 3) Inline code vs math

- Inline code: `npm run dev:all`, `python -m app.main`, `x ** 2 + x**
- Math inline: $x^2 + x$, $e^{{{s2:.1f}}}$, $f\\colon X \\to Y$
- Kombinasi berbatasan: kode `$x ** 2` dan math $x**2$ — keduanya beda render.

### 4) Tabel rekap hasil praktik

| Uji | Kode | Math | Tabel | Status sukses |
| --- | --- | --- | --- | --- |
| a | ✅ | ✅ | — | nilai $\\ge {s1:.1f}$ |
| b | ✅ | — | ✅ | baris mengetik `$$` tak bocor |
| c | — | ✅ | ✅ | warna katex mengikuti var(--warning) |
| d | ✅ | ✅ | ✅ | semua bersamaan |

### 5) Stabilitas dipenggaruh salin

Tombol salin (Excel/MD) di pojokan tabel hanya boleh mengambil tabel,
bukan teks di luar. Penggaris akalnya {s1:.1f} → nilai akhir:
$k = {s1:.1f}\\,k_1 + {s2:.1f}\\,k_2$, dengan $k_{{ {s2:.1f} }}$.
"""
    return isi


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument("--out", type=Path, default=REPO / "tests" / "fixtures" / "rendering_suite")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    out: Path = args.out
    out.mkdir(parents=True, exist_ok=True)

    readme = f"""# Fixture Uji Rendering Kabayan Pintar

Dihasilkan oleh `scripts/testing/generate_rendering_fixtures.py` (seed={args.seed}).
Struktur: **10 folder temA × 3 file** = 30 file markdown. Setiap file mengandung
campuran LaTeX (inline `$` & varian `\\[..\\]`, `\\(..\\)`), tabel GFM, dan blok kode.

## Tujuan tiap tipe file

| File | Fokus uji | Kebocoran yang dideteksi |
| --- | --- | --- |
| `01_*` | math inline/block + tabel kecil dgn math di sel | KaTeX error, heading rusak, `$` uang salah dirender |
| `02_*` | matriks pmatrix, tabel lebar x overflow, `\\[..\\]` | kolom tabel roboh, dolar literal merusak baris |
| `03_*` | 2 blok kode beda bahasa + tabel + kombinasi `$` | highlighter gagal, inline code dirubah jadi math |

## Cara pemakaian

1. Jalankan app, buka Chat → mode **Tutor aktif**.
2. Tempel isi salah satu file ke pesan awal atau generate notebook/quiz/flashcard
   dengan konten file sebagai sumber.
3. Bandingkan: apakah formula ditampilkan penuh, tabel tidak lolos batas,
   kode berwarna & terbaca, tombol salin tersedia.
\n"""
    (out / "README.md").write_text(readme, encoding="utf-8")

    for i, (nama, tema_nama, konsep) in enumerate(TEMA, start=1):
        d = out / nama
        d.mkdir(parents=True, exist_ok=True)
        for j, builder in enumerate((buat_file_1, buat_file_2, buat_file_3), start=1):
            teks = builder(d, i, tema_nama, konsep, rng)
            (d / f"{i:02d}_render_{j:02d}.md").write_text(teks, encoding="utf-8")
        print(f"selesai folder {nama}: 3 file")

    print(f"\nTotal: 10 folder × 3 file = 30 file di {out}")


if __name__ == "__main__":
    main()
