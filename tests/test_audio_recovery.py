"""Recovery audio TTS yang tertinggal Processing setelah server restart."""
from app.models import AudioGeneration
from app.services.audio_service import recover_stale_audio


def test_recover_stale_audio_marks_only_processing_rows_failed(
    db_session, make_subject, make_material
):
    subject = make_subject("Audio")
    material = make_material(subject.id, status="Ready")

    stale = AudioGeneration(
        material_id=material.id,
        subject_id=subject.id,
        voice="id-ID-GadisNeural",
        status="Processing",
        progress=26,
        stage="Generating audio 4/15",
    )
    ready = AudioGeneration(
        material_id=material.id,
        subject_id=subject.id,
        voice="id-ID-GadisNeural",
        status="Ready",
        progress=100,
        stage="Selesai",
    )
    db_session.add_all([stale, ready])
    db_session.commit()
    db_session.refresh(stale)
    db_session.refresh(ready)

    recovered = recover_stale_audio(db_session)

    assert recovered == 1
    db_session.refresh(stale)
    db_session.refresh(ready)
    assert stale.status == "Failed"
    assert stale.stage == "Gagal"
    assert "server dimulai ulang" in stale.error
    assert ready.status == "Ready"


def test_recover_stale_audio_is_noop_when_nothing_is_processing(db_session):
    assert recover_stale_audio(db_session) == 0
