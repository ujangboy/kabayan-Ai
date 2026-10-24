"""D4 — deteksi material_type saat upload: ekstensi menentukan tipe (regresi Excel/PPT dilabeli PDF)."""
import io
import os
from fastapi import UploadFile
from app.services.material_service import material_service


def _upload(db, subject_id, filename: str, content: bytes):
    f = UploadFile(filename=filename, file=io.BytesIO(content))
    return material_service.upload_material_sync(db, subject_id, f)


def test_upload_xlsx_stores_xlsx(db_session, make_subject):
    subject = make_subject()
    filepath, mat_id = _upload(db_session, subject.id, "Pekan 11_PAK.xlsx", b"PK\x03\x04fake-xlsx")
    assert os.path.basename(filepath).endswith(".xlsx")

    from app.repositories.material_repository import material_repository
    mat = material_repository.get(db_session, mat_id)
    assert mat.material_type.value == "XLSX"


def test_upload_pptx_stores_pptx(db_session, make_subject):
    subject = make_subject()
    filepath, mat_id = _upload(db_session, subject.id, "presentasi.pptx", b"PK\x03\x04fake-pptx")
    assert os.path.basename(filepath).endswith(".pptx")

    from app.repositories.material_repository import material_repository
    mat = material_repository.get(db_session, mat_id)
    assert mat.material_type.value == "PPTX"


def test_upload_pdf_stores_pdf(db_session, make_subject):
    subject = make_subject()
    _, mat_id = _upload(db_session, subject.id, "materi.pdf", b"%PDF-fake")

    from app.repositories.material_repository import material_repository
    mat = material_repository.get(db_session, mat_id)
    assert mat.material_type.value == "PDF"


def test_upload_unknown_extension_falls_back_to_pdf(db_session, make_subject):
    subject = make_subject()
    _, mat_id = _upload(db_session, subject.id, "catatan.xyz", b"data")

    from app.repositories.material_repository import material_repository
    mat = material_repository.get(db_session, mat_id)
    assert mat.material_type.value == "PDF"


def test_material_without_type_is_none_not_pdf(db_session, make_subject):
    """Regresi: default kolom tidak boleh diam-diam melabeli PDF (masker bug tipe salah)."""
    from app.models import Material
    subject = make_subject()

    mat = Material(subject_id=subject.id, filename="tanpa_tipe.bin", status="Pending")
    db_session.add(mat)
    db_session.commit()

    assert mat.material_type is None