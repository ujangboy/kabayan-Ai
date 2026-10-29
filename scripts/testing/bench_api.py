#!/usr/bin/env python3
"""Benchmark performa API Kabayan Pintar.

Mengukur:
  A. Latensi endpoint GET utama (mean/p50/p95/max, N request per endpoint)
  B. Streaming /api/tutor/chat — waktu first-chunk (TTFT), total, char/s,
     category routing (SIMPLE/MEDIUM/COMPLEX) per kelas pertanyaan
  C. POST /api/tutor/classify latensi

Pemakaian:
  python scripts/testing/bench_api.py [--base http://localhost:8000] [--n 6] [--full]

Salin sebagai laporan baseline performa; jangan commit nilai env.
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
import uuid
from pathlib import Path

import requests

WAKTU = {}
KATEGORI_RATA = {}

GET_ENDPOINTS = [
    ("/health", None),
    ("/api/info", None),
    ("/api/settings", None),
    ("/api/dashboard/stats", None),
    ("/api/subjects", None),
    ("/api/materials", None),
    ("/api/chats", None),
    ("/api/notes", None),
    ("/api/flashcards", None),
    ("/api/quizzes", None),
    ("/api/usage", None),
    ("/api/data/overview", None),
    ("/api/trash", None),
    ("/api/tutor/faq", None),
    ("/api/tutor/profile", None),
    ("/api/tutor/stats", None),
    ("/api/profile", None),
]

KASUS_TUTOR = [
    # (memilih kategori, pertanyaan)
    ("SIMPLE-ish", "Halo, siapa kamu?"),
    ("SIMPLE-ish", "apa itu numpy"),
    ("MEDIUM-ish", "Jelaskan perbedaan integral tentu dan integral tak tentu!"),
    ("MEDIUM-ish", "Berapa hasil dari integral x^2 dx dan bagaimana cara mengerjakannya?"),
    ("COMPLEX-ish", "Sebuah matriks A berukuran 3x3 dengan det A = 0. Analisis properti eiganvalue-nya dan implikasi geometrisnya bagi transformasi linear di R^3."),
    ("COMPLEX-ish", "Bandingkan); konvergensi metode bisection, Newton-Raphson, dan secant dengan analisis error; mana yang paling cepat dan kondisi yang mana gagal?"),
    ("LaTeX-bergatang", "Jelaskan cara mengerjakan kuantor silang $\\oint_C \\vec{F}\\cdot d\\vec{r}$ dan berikan contoh matriks 2x2 + tabel konvergensi."),
]


def hitung_waktu(func, n: int) -> dict:
    hasil = []
    for _ in range(n):
        t0 = time.perf_counter()
        err = None
        try:
            func()
        except Exception as e:  # noqa: BLE001 — benchmark, laporkan error-nya saja
            err = repr(e)
        hasil.append((time.perf_counter() - t0) * 1000)
    val = sorted(hasil)
    return {
        "p50": round(statistics.median(val), 1),
        "mean": round(statistics.fmean(val), 1),
        "min": round(val[0], 1),
        "max": round(val[-1], 1),
        "p95": round(val[min(len(val) - 1, int(0.95 * len(val)))], 1),
        "error": err,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://localhost:8000")
    parser.add_argument("--n", type=int, default=5)
    parser.add_argument("--full", action="store_true", help="sertakan streaming tutor")
    args = parser.parse_args()
    base = args.base.rstrip("/")

    print(f"Benchmark API Kabayan → {base} | n={args.n}\n")

    # ── A. GET endpoints ─────────────────────────────────────────────────────
    print("== A. Endpoint GET (ms) ==")
    baris = []
    for path, _ in GET_ENDPOINTS:
        r = requests.get(base + path, timeout=15)
        if r.status_code != 200:
            r = requests.get(base + path, timeout=15)
            status = r.status_code
            if status >= 300:
                baris.append((path, f"{status} SKIPPED"))
                continue
        stats = hitung_waktu(lambda p=path: requests.get(base + p, timeout=15), args.n)
        baris.append((path, f"{stats['p50']:>7} p50 | {stats['p95']:>8} p95 | {stats['max']:>8} max | ok"))
    for p, v in baris:
        print(f"  {p:<28} {v}")

    # ── B. Streaming tutor ───────────────────────────────────────────────────
    if args.full:
        print("\n== B. Streaming /api/tutor/chat ==")
        sid = str(uuid.uuid4())
        for label, pesan in KASUS_TUTOR:
            t0 = time.perf_counter()
            first = None
            total_chars = 0
            tipe = "?"
            try:
                with requests.post(
                    f"{base}/api/tutor/chat",
                    json={
                        "message": pesan,
                        "history": [],
                        "session_id": sid,
                        "mata_kuliah": None,
                        "student_level": "intermediate",
                        "rag_docs": [],
                    },
                    stream=True,
                    timeout=120,
                ) as resp:
                    tipe = resp.headers.get("X-Tutor-Type", "?")
                    first_seen = False
                    for chunk in resp.iter_content(chunk_size=16, decode_unicode=True):
                        if chunk:
                            if not first_seen:
                                first = (time.perf_counter() - t0) * 1000
                                first_seen = True
                            total_chars += len(chunk)
            except Exception as e:  # noqa: BLE001
                print(f"  ERROR {label}: {e!r}")
                continue
            total = (time.perf_counter() - t0) * 1000
            ttft = first if first is not None else total
            cps = total_chars / max(total / 1000, 1e-6)
            print(
                f"  {label:<18} tipe={tipe:<7} TTFT={ttft:7.0f} ms | "
                f"total={total:7.0f} ms | {total_chars} char | {cps:6.0f} char/s"
            )

        # ── C. classifier ──────────────────────────────────────────────────
        print("\n== C. POST /api/tutor/classify ==")
        for label, pesan in KASUS_TUTOR[:4]:
            stats = hitung_waktu(
                lambda p=pesan: requests.post(
                    base + "/api/tutor/classify", json={"message": p, "history": []}, timeout=30
                ),
                args.n,
            )
            print(f"  {label:<18} {stats}")

    print("\nSelesai. Simpan hasil ini sebagai baseline.")


if __name__ == "__main__":
    main()
