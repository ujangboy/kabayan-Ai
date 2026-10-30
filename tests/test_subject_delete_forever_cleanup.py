"""Hapus permanen subjek wajib membersihkan RAG chunk dan file audio."""
from app.models import AudioGeneration, Subject
from app.services.subject_service import subject_service


def test_delete_forever_purges_rag_and_audio(
    db_session, make_subject, make_material, tmp_path, monkeypatch
):
    from app.services.rag_service import rag_service

    subject = make_subject()
    m1 = make_material(subject.id, status="Ready", filepath=str(tmp_path / "a.txt"))
    m2 = make_material(subject.id, status="Ready", filepath=str(tmp_path / "b.txt"))

    audio_file = tmp_path / "voice.mp3"
    audio_file.write_bytes(b"ID3")
    db_session.add(AudioGeneration(
        material_id=m1.id,
        subject_id=subject.id,
        voice="id-ID-ArdiNeural",
        status="Ready",
        file_path=str(audio_file),
    ))
    subject.status = "trashed"
    db_session.commit()

    purged = []
    monkeypatch.setattr(
        rag_service, "delete_document_chunks", lambda doc_id: purged.append(doc_id)
    )
    monkeypatch.setattr(rag_service, "_should_rebuild", lambda: False)

    assert subject_service.delete_forever(db_session, subject.id) is True

    assert set(purged) == {f"mat_{m1.id}", f"mat_{m2.id}"}
    assert not audio_file.exists()
    assert db_session.get(Subject, subject.id) is None
