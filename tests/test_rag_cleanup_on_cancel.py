"""Cancel tepat saat indexing tidak boleh meninggalkan chunk RAG hantu."""
import os

from app import config
from app.models import Material
from app.services import material_service as material_service_module
from app.services.material_service import material_service


def test_cancel_during_indexing_purges_chunks(
    db_session, make_subject, make_material, monkeypatch
):
    from app.services.rag_service import rag_service

    subject = make_subject()
    fp = os.path.join(config.UPLOADS_DIR, "cancel_index.md")
    with open(fp, "w", encoding="utf-8") as f:
        f.write("Konten materi untuk uji chunk. " * 30)
    mat = make_material(subject.id, status="Processing", filepath=fp)

    purged = []

    def fake_index(doc_id, chunks):
        # Simulasi user menekan Cancel tepat saat indexing berlangsung.
        s = material_service_module.SessionLocal()
        try:
            row = s.get(Material, mat.id)
            row.status = "Failed"
            row.failure_reason = "Dibatalkan oleh user."
            s.commit()
        finally:
            s.close()

    monkeypatch.setattr(rag_service, "index_document", fake_index)
    monkeypatch.setattr(
        rag_service, "delete_document_chunks", lambda doc_id: purged.append(doc_id)
    )

    material_service.process_material_async(fp, f"mat_{mat.id}", mat.id)

    assert purged == [f"mat_{mat.id}"]
    db_session.expire_all()
    assert db_session.get(Material, mat.id).status == "Failed"
