#!/usr/bin/env python3
"""E2E feature sweep — uji sarang fitur Kabayan Pintar melalui API nyata.

Alur yang diuji (masing-masing dicatat durasi & status):
  1. Buat subject uji
  2. Upload 2 file .md fixture → poll sampai Ready (pipeline parser+RAG)
  3. Generate catatan AI dari materi
  4. Generate flashcards (AI)
  5. Review flashcard (SRS/FSRS)
  6. Generate quiz (AI) + simpan skor
  7. Export note/flashcards/quiz
  8. Audio TTS: list endpoint + buat entri percobaan (status semua pola).
  9. Backup create + list
 10. Trash: delete subject → trash list → restore → delete permanen

Pemakaian:
  python scripts/testing/e2e_feature_sweep.py [--base http://localhost:8000]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import uuid
from pathlib import Path

import requests

REPO = Path(__file__).resolve().parents[2]
FIXTURE = REPO / "tests" / "fixtures" / "rendering_suite"
NAMA_SUBJECT = "[E2E] Uji Sweep Botol 10x3"

HASIL: list[dict] = []


def catat(langkah: str, ok: bool, durasi: float, info: str = "") -> None:
    HASIL.append({"langkah": langkah, "ok": ok, "durasi": durasi, "info": info})
    status = "PASS" if ok else "FAIL"
    print(f"  [{status}] {langkah:<34} {durasi*1000:8.0f} ms  {info}")


def beri_langkah(nama: str):
    def wrap(fn):
        def jalankan():
            t0 = time.perf_counter()
            try:
                ok, info = fn()
            except Exception as e:  # noqa: BLE001
                ok, info = False, repr(e)[:180]
            catat(nama, ok, time.perf_counter() - t0, info)
            return ok
        return jalankan
    return wrap


class Konteks:
    subject_id: int | None = None
    material_ids: list[int] = []
    note_id: int | None = None
    quiz_id: int | None = None
    deck_id: int | None = None


k = Konteks()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://localhost:8000")
    parser.add_argument("--skip-audio", action="store_true")
    args = parser.parse_args()
    base = args.base.rstrip("/")
    s = requests.Session()

    print(f"E2E feature sweep → {base}\n")

    # 1. Subject ----------------------------------------------------------------
    def langkah_subject():
        r = s.post(
            base + "/api/subjects",
            data={"name": NAMA_SUBJECT, "semester": "Ganjil 2026", "lecturer": "-"},
            timeout=30,
        )
        body = r.json()
        k.subject_id = body.get("subject", {}).get("id")
        return r.status_code == 200 and k.subject_id, f"id={k.subject_id}"

    beri_langkah("Buat subject")(langkah_subject)()
    if not k.subject_id:
        print("subject gagal dibuat — hentikan sweep.")
        return 1

    # 2. Upload materi ----------------------------------------------------------
    for path in sorted(FIXTURE.rglob("01_render_01.md"))[:1] + sorted(FIXTURE.rglob("02_render_02.md"))[:1]:
        def langkah_upload(p=path):
            data = {"subject_id": str(k.subject_id)}
            with open(p, "rb") as fh:
                r = s.post(
                    base + "/api/materials",
                    files={"file": (p.name, fh, "text/markdown")},
                    data=data,
                    timeout=60,
                )
            mid = r.json().get("material_id")
            if mid:
                k.material_ids.append(mid)
            return r.status_code == 200, f"{p.name} → id={mid}"

        beri_langkah(f"Upload {path.name}")(langkah_upload)()

    # Poll Ready sampai kedua file selesai (maks 180 s)
    def poll_ready():
        batas = time.time() + 180
        while time.time() < batas:
            r = s.get(base + "/api/materials", params={"subject_id": k.subject_id}, timeout=30)
            items = r.json().get("materials", [])
            active = [m for m in items if m["id"] in k.material_ids]
            st = {m["id"]: m["status"] for m in active}
            if st and all(v == "Ready" for v in st.values()):
                return True, json.dumps(st)
            if any(v in ("Failed", "Error") for v in st.values()):
                return False, json.dumps(st)
            time.sleep(2)
        return False, "timeout menunggu Ready"

    beri_langkah("Pipeline materi siap (parser+RAG)")(poll_ready)()

    mid = ",".join(str(x) for x in k.material_ids) or None

    # 3. Generate notes ---------------------------------------------------------
    def langkah_notes():
        r = s.post(
            base + "/api/notes/generate",
            json={"subject_id": k.subject_id, "material_ids": mid, "title": "Catatan Uji E2E"},
            timeout=180,
        )
        body = r.json()
        content = body.get("content", "")
        ok = r.status_code == 200 and body.get("status") == "success"
        # Simpan sebagai notebook — endpoint memakai FORM (bukan JSON)
        r2 = s.post(
            base + "/api/notes",
            data={"title": body.get("title", "Catatan E2E"), "content": content},
            timeout=30,
        )
        info = f"len={len(content)}, save={r2.status_code}"
        return ok and r2.status_code == 200, info

    beri_langkah("Generate catatan AI + simpan")(langkah_notes)()

    # 4. Flashcards generate ----------------------------------------------------
    def langkah_flashcards():
        r = s.post(
            base + "/api/flashcards/generate",
            json={"subject_id": k.subject_id, "material_ids": mid, "count": 5},
            timeout=180,
        )
        body = r.json()
        return r.status_code == 200 and body.get("status") == "success", \
            f"count={body.get('count')}, batch={body.get('batch_id')}"

    beri_langkah("Generate flashcards AI")(langkah_flashcards)()

    # ambil kartu pertama untuk review
    def langkah_review():
        r = s.get(base + "/api/flashcards", timeout=30)
        flats = r.json().get("flashcards", [])
        if not flats:
            return False, "tidak ada kartu"
        fc = flats[0]
        r2 = s.post(
            base + "/api/flashcards/review",
            json={"flashcard_id": fc["id"], "rating": 3, "response_time_ms": 2500},
            timeout=30,
        )
        ok = r2.status_code == 200
        return ok, f"rating=3, id={fc['id']}"

    beri_langkah("Review flashcard (FSRS)")(langkah_review)()

    # 5. Quiz generate + score --------------------------------------------------
    def langkah_quiz():
        r = s.post(
            base + "/api/quizzes/generate",
            json={"subject_id": k.subject_id, "mcq_count": 5, "material_ids": mid, "difficulty": "sedang"},
            timeout=180,
        )
        b = r.json()
        # Respons quiz_service langsung: cari id di beberapa bentuk umum
        qid = None
        for pola in (b.get("quiz_id"), (b.get("quiz") or {}).get("id"),
                     (b.get("quiz") or {}).get("quiz_id")):
            if isinstance(pola, int):
                qid = pola
                break
        if qid is None and isinstance(b.get("id"), int):
            qid = b["id"]
        k.quiz_id = qid
        return r.status_code == 200, f"keys={list(b.keys())[:6]}, quiz_id={qid}"

    beri_langkah("Generate quiz AI")(langkah_quiz)()

    def langkah_score():
        if not k.quiz_id:
            return False, "skip (quiz_id kosong)"
        r = s.post(
            f"{base}/api/quizzes/{k.quiz_id}/score",
            data={"score": 80, "correct_count": 4, "wrong_count": 1, "total_questions": 5, "time_taken": 120},
            timeout=30,
        )
        return r.status_code == 200, json.dumps(r.json())[:80]

    beri_langkah("Simpan skor quiz")(langkah_score)()

    # 6. Export ------------------------------------------------------------------
    KONTEN_EKSP = "Deret Fourier memura antara konvuluasi periodic dan sebaran bola kaca."
    for kind in ("note", "flashcards", "quiz"):
        def langkah_export(kd=kind):
            r = s.post(
                base + f"/api/export/{kd}",
                json={"content": KONTEN_EKSP, "subject_id": k.subject_id},
                timeout=60,
            )
            return r.status_code == 200, json.dumps(r.json())[:80]

        beri_langkah(f"Export {kind}")(langkah_export)()

    # 7. Audio -------------------------------------------------------------------
    if not args.skip_audio:
        def langkah_audio():
            r = s.get(base + "/api/audio/voices", timeout=30)
            voices = []
            try:
                voices = r.json().get("voices", [])
            except Exception:
                pass
            vname = voices[0].get("id") if voices else None
            if not vname:
                return False, f"voices HTTP {r.status_code}"
            r2 = s.post(
                base + "/api/audio/generate",
                json={"material_id": k.material_ids[0], "voice": vname},
                timeout=30,
            )
            aid = r2.json().get("id")
            if not aid:
                return False, f"generate HTTP {r2.status_code}: {r2.text[:60]}"
            # Poll sampai selesai (TTS worker berjalan di background)
            deadline = time.time() + 180
            status = "?"
            while time.time() < deadline:
                st = s.get(f"{base}/api/audio/{aid}/status", timeout=15).json()
                status = st.get("status", "?")
                if status in ("done", "ready", "Ready", "success"):
                    return True, f"voice={vname}, akhir={status}"
                if status in ("failed", "error", "cancelled"):
                    return False, f"voice={vname}, akhir={status}"
                time.sleep(3)
            return False, f"timeout, status terakhir={status}"

        beri_langkah("Audio TTS create→done")(langkah_audio)()

    # 8. Backup -------------------------------------------------------------------
    def langkah_backup():
        r = s.post(base + "/api/backup/create", timeout=120)
        ok = r.status_code == 200
        rl = s.get(base + "/api/backup/list", timeout=30)
        jumlah = len(rl.json().get("backups", []))
        return ok and rl.status_code == 200, f"backups={jumlah}"

    beri_langkah("Backup create+list")(langkah_backup)()

    # 9. Trash alur ---------------------------------------------------------------
    def langkah_trash():
        r = s.post(f"{base}/api/subjects/{k.subject_id}/delete", timeout=30)
        rt = s.get(base + "/api/subjects/trash", timeout=30)
        rr = s.post(f"{base}/api/subjects/{k.subject_id}/restore", timeout=30)
        rd = s.post(f"{base}/api/subjects/{k.subject_id}/delete", timeout=30)
        # delete bersarkan? delete pertama = soft, kedua = permanen? uji lagi restore list:
        ok = (
            r.status_code == 200
            and rt.status_code == 200
            and rr.status_code in (200, 404)
            and rd.status_code in (200, 404)
        )
        return ok, f"del={r.status_code}, trash={rt.status_code}, restore={rr.status_code}, del2={rd.status_code}"

    beri_langkah("Trash: delete→restore→delete")(langkah_trash)()

    # Laporan ---------------------------------------------------------------------
    total = len(HASIL)
    gagal = sum(1 for h in HASIL if not h["ok"])
    print(f"\nTotal langkah: {total}, gagal: {gagal}")
    if gagal:
        print("Tindakan lain yang perlu dindatap:")
        for h in HASIL:
            if not h["ok"]:
                print(f"  - {h['langkah']}: {h['info']}")
    return 0 if gagal == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
