"""Rebuild the LanceDB RAG index for Ready materials missing from the index.

Usage:
    venv/bin/python scripts/rebuild_rag_index.py [--subject-id 2] [--force]

Tanpa --force, hanya materi yang belum punya chunk aktif yang di-index ulang.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import Material
from app.services.material_service import material_service
from app.services.rag_service import rag_service


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--subject-id", type=int, default=None)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    rag_service._ensure_loaded()
    db = SessionLocal()
    indexed = 0
    skipped = 0
    failed = 0
    try:
        query = db.query(Material).filter(
            Material.status == "Ready",
            Material.filepath.isnot(None),
        )
        if args.subject_id:
            query = query.filter(Material.subject_id == args.subject_id)

        for material in query.order_by(Material.id).all():
            doc_id = f"mat_{material.id}"
            has_chunks = doc_id in rag_service.doc_to_chunk_indices
            if has_chunks and not args.force:
                skipped += 1
                continue
            try:
                ok = material_service.index_material_file(db, material)
                if ok:
                    indexed += 1
                    print(f"indexed mat_{material.id} ({material.filename})")
                else:
                    failed += 1
                    print(f"FAILED  mat_{material.id} ({material.filename}): file/konten kosong")
            except Exception as exc:
                failed += 1
                print(f"FAILED  mat_{material.id} ({material.filename}): {exc}")
    finally:
        db.close()

    print(f"done: indexed={indexed} skipped={skipped} failed={failed}")
    print("index stats:", rag_service.get_stats())
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
