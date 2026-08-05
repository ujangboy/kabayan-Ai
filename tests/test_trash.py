"""Recycle bin — soft-delete materi, list sampah, restore, hapus permanen."""
import os
import pytest
import config
from models import TrashItem, Material
from services.material_service import material_service
from services.trash_service import (
    list_trash,
    restore_material,
    delete_material_permanent,
    delete_item_permanent,
    empty_trash,
)


@pytest.fixture()
def client(db_session):
    from fastapi.testclient import TestClient
    from main import app
    from database import get_db
    app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(app)
    app.dependency_overrides.clear()


def _trash_contents():
    return os.listdir(config.TRASH_DIR)


def test_delete_moves_to_trash_soft(db_session, make_subject, make_material):
    """Hapus materi = soft-delete: file masuk trash, status Trashed, record tetap."""
    subject = make_subject()
    fp = os.path.join(config.UPLOADS_DIR, "hapus.pdf")
    with open(fp, "wb") as f:
        f.write(b"%PDF-1.4 dummy")
    mat = make_material(subject.id, status="Ready", filepath=fp)

    ok = material_service.delete(db_session, mat.id)

    assert ok is True
    db_session.expire_all()
    mat2 = db_session.query(Material).get(mat.id)
    assert mat2 is not None                      # record tidak hilang
    assert mat2.status == "Trashed"
    assert not os.path.exists(fp)                # file fisik sudah di trash
    assert _trash_contents()                     # ada file di sampah
    items = list_trash(db_session)
    assert any(i["material_id"] == mat.id for i in items)


def test_trashed_material_hidden_from_listing(db_session, make_subject, make_material):
    """Materi sampah tidak muncul di listing materi aktif."""
    subject = make_subject()
    fp = os.path.join(config.UPLOADS_DIR, "sembunyi.pdf")
    with open(fp, "wb") as f:
        f.write(b"%PDF-1.4")
    mat = make_material(subject.id, status="Ready", filepath=fp)
    material_service.delete(db_session, mat.id)

    active = material_service.get_by_subject(db_session, subject.id)
    assert mat.id not in [m.id for m in active]


def test_restore_material_returns_file_and_status(db_session, make_subject, make_material):
    """Restore mengembalikan file fisik + status materi (Ready)."""
    subject = make_subject()
    fp = os.path.join(config.UPLOADS_DIR, "restore.pdf")
    with open(fp, "wb") as f:
        f.write(b"%PDF-1.4")
    mat = make_material(subject.id, status="Ready", filepath=fp)
    material_service.delete(db_session, mat.id)
    assert not os.path.exists(fp)

    ok = restore_material(db_session, mat.id)

    assert ok is True
    db_session.expire_all()
    mat2 = db_session.query(Material).get(mat.id)
    assert mat2.status == "Ready"
    assert mat2.filepath == fp                       # filepath kembali
    assert os.path.exists(fp)                        # file kembali ke path asli
    assert db_session.query(TrashItem).count() == 0


def test_delete_material_permanent_removes_record_and_file(db_session, make_subject, make_material):
    """Hapus permanen: file trunk hilang, TrashItem hilang, record hilang."""
    subject = make_subject()
    fp = os.path.join(config.UPLOADS_DIR, "permanen.pdf")
    with open(fp, "wb") as f:
        f.write(b"%PDF-1.4")
    mat = make_material(subject.id, status="Ready", filepath=fp)
    material_service.delete(db_session, mat.id)

    ok = delete_material_permanent(db_session, mat.id)

    assert ok is True
    assert _trash_contents() == []               # file trunk sudah dihapus
    assert db_session.query(TrashItem).count() == 0
    assert db_session.query(Material).get(mat.id) is None


def test_empty_trash_removes_all_files(db_session, make_subject, make_material):
    subject = make_subject()
    ids = []
    for i in range(2):
        fp = os.path.join(config.UPLOADS_DIR, f"f{i}.pdf")
        with open(fp, "wb") as f:
            f.write(b"%PDF")
        mat = make_material(subject.id, status="Ready", filepath=fp)
        material_service.delete(db_session, mat.id)
        ids.append(mat.id)
    assert len(_trash_contents()) == 2

    count = empty_trash(db_session)

    assert count >= 2
    assert _trash_contents() == []
    # Kosongkan sampah juga menghapus record materi Trashed (anti-zombie):
    # tak tersisa materi status Trashed tanpa TrashItem yang tak bisa di-restore.
    assert db_session.query(TrashItem).count() == 0
    assert db_session.query(Material).filter(Material.id.in_(ids)).count() == 0


def test_trash_api_flow(client, db_session, make_subject, make_material):
    """End-to-end lewat API: soft delete -> list -> restore."""
    subject = make_subject()
    fp = os.path.join(config.UPLOADS_DIR, "api.pdf")
    with open(fp, "wb") as f:
        f.write(b"%PDF-api")
    mat = make_material(subject.id, status="Ready", filepath=fp)

    r = client.post(f"/api/materials/{mat.id}/delete")
    assert r.status_code == 200

    lst = client.get("/api/trash").json()["items"]
    assert any(i["material_id"] == mat.id for i in lst)

    item = next(i for i in lst if i["material_id"] == mat.id)
    r2 = client.post(f"/api/trash/materials/{mat.id}/restore")
    assert r2.status_code == 200
    assert os.path.exists(fp)


def test_orphan_files_registered_without_metadata(db_session):
    """File trash lama (tanpa TrashItem) otomatis tampil sebagai orphan."""
    from services.trash_service import list_trash, empty_trash
    # Simulasikan file yang masuk trash sebelum fitur (trash_file tanpa metadata)
    name1 = "lama_ab12cd34.pdf"
    name2 = "tanpauuid.docx"
    with open(os.path.join(config.TRASH_DIR, name1), "wb") as f:
        f.write(b"%PDF-lama")
    with open(os.path.join(config.TRASH_DIR, name2), "wb") as f:
        f.write(b"PK-docx")

    items = list_trash(db_session)

    names = {i["original_filename"] for i in items}
    assert "lama.pdf" in names          # suffix uuid dihapus
    assert "tanpauuid.docx" in names    # tanpa uuid tetap apa adanya
    assert all(i["source_type"] == "orphan" for i in items if i["material_id"] is None)
    # Bisa dikosongkan
    assert empty_trash(db_session) >= 2
    assert os.listdir(config.TRASH_DIR) == []