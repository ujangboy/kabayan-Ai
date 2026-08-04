"""D4 — jalur gagal materi: extract gagal, cancel, orphan sweep, subject delete, trash."""
import os
import time
import config
from services.material_service import material_service
from services.storage_cleanup_service import cleanup_orphan_files, cleanup_trash, trash_file


def _trash_contents():
    return os.listdir(config.TRASH_DIR)


def test_process_extract_fail_marks_failed_and_trashes_file(db_session, make_subject, make_material):
    subject = make_subject()
    fp = os.path.join(config.UPLOADS_DIR, "empty.txt")
    with open(fp, "w", encoding="utf-8") as f:
        f.write("")  # tidak ada teks yang bisa diekstrak
    mat = make_material(subject.id, status="Processing", filepath=fp)

    material_service.process_material_async(fp, f"mat_{mat.id}", mat.id)

    db_session.expire_all()
    db_session.refresh(mat)
    assert mat.status == "Failed"
    assert mat.filepath is None
    assert not os.path.exists(fp)
    assert _trash_contents()


def test_process_extract_exception_marks_failed(db_session, make_subject, make_material):
    subject = make_subject()
    fp = os.path.join(config.UPLOADS_DIR, "weird.xyz")
    with open(fp, "w", encoding="utf-8") as f:
        f.write("data")  # ekstensi tak dikenal → extract_text melempar
    mat = make_material(subject.id, status="Processing", filepath=fp)

    material_service.process_material_async(fp, f"mat_{mat.id}", mat.id)

    db_session.expire_all()
    db_session.refresh(mat)
    assert mat.status == "Failed"
    assert mat.filepath is None
    assert not os.path.exists(fp)


def test_cancel_trashes_file_and_marks_failed(db_session, make_subject, make_material):
    subject = make_subject()
    fp = os.path.join(config.UPLOADS_DIR, "cancel.pdf")
    with open(fp, "w", encoding="utf-8") as f:
        f.write("x")
    mat = make_material(subject.id, status="Processing", filepath=fp)

    ok = material_service.cancel(db_session, mat.id)

    assert ok is True
    db_session.refresh(mat)
    assert mat.status == "Failed"
    assert mat.filepath is None
    assert not os.path.exists(fp)
    assert _trash_contents()


def test_cancel_idempotent_when_not_processing(db_session, make_subject, make_material):
    subject = make_subject()
    mat = make_material(subject.id, status="Ready", filepath=None)

    assert material_service.cancel(db_session, mat.id) is False


def test_cleanup_orphan_trashes_orphan_keeps_referenced(db_session, make_subject, make_material):
    subject = make_subject()
    keep = os.path.join(config.UPLOADS_DIR, "keep.pdf")
    orphan = os.path.join(config.UPLOADS_DIR, "orphan.txt")
    with open(keep, "w", encoding="utf-8") as f:
        f.write("k")
    with open(orphan, "w", encoding="utf-8") as f:
        f.write("o")
    make_material(subject.id, status="Ready", filepath=keep)

    result = cleanup_orphan_files(db_session)

    assert os.path.exists(keep)
    assert not os.path.exists(orphan)
    assert result["count"] == 1
    # file orphan masuk trash (dengan suffix unik)
    assert any("orphan" in n for n in _trash_contents())


def test_delete_subject_sweeps_orphan_files(db_session, make_subject, make_material):
    from services.subject_service import subject_service
    subject = make_subject()
    fp = os.path.join(config.UPLOADS_DIR, "subj.pdf")
    with open(fp, "w", encoding="utf-8") as f:
        f.write("x")
    make_material(subject.id, status="Ready", filepath=fp)

    subject_service.delete(db_session, subject.id)
    db_session.commit()

    # materi cascade-delete → file jadi yatim → dipindah ke trash
    assert not os.path.exists(fp)
    assert _trash_contents()


def test_trash_retention_removes_only_old_files(db_session):
    old_file = os.path.join(config.TRASH_DIR, "old.bin")
    with open(old_file, "w", encoding="utf-8") as f:
        f.write("x")
    old = time.time() - 30 * 86400  # 30 hari lalu
    os.utime(old_file, (old, old))

    fresh_file = os.path.join(config.TRASH_DIR, "fresh.bin")
    with open(fresh_file, "w", encoding="utf-8") as f:
        f.write("y")

    result = cleanup_trash(max_age_days=7)

    assert not os.path.exists(old_file)   # umur > 7 hari → dibuang permanen
    assert os.path.exists(fresh_file)     # masih baru → dipertahankan
    assert result["count"] == 1


def test_trash_file_ignores_missing(db_session):
    assert trash_file(os.path.join(config.UPLOADS_DIR, "tidak-ada.pdf")) is False
