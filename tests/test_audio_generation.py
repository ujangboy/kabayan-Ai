"""Regression tests untuk perbaikan Edge TTS dan lifecycle job audio."""
import asyncio
import os
from pathlib import Path

from sqlalchemy.orm import sessionmaker

from app.models import AudioGeneration
from app.services import audio_service


def test_resolve_edge_tts_endpoint_migrates_legacy_host():
    endpoint = audio_service.resolve_edge_tts_endpoint(
        "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=old",
        token="token-uji",
    )
    assert endpoint.startswith(
        "wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1"
    )
    assert "Ocp-Apim-Subscription-Key=token-uji" in endpoint


def test_resolve_edge_tts_endpoint_honors_override_and_current_host():
    assert (
        audio_service.resolve_edge_tts_endpoint(
            "wss://speech.platform.bing.com/old", override="wss://tts.example/ws"
        )
        == "wss://tts.example/ws"
    )
    current = "wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1?x=1"
    assert audio_service.resolve_edge_tts_endpoint(current) == current


def test_speak_retries_transient_failure(monkeypatch, tmp_path):
    attempts = []
    out = tmp_path / "chunk.mp3"

    async def flaky_speak(text, voice, path):
        attempts.append(text)
        if len(attempts) == 1:
            raise RuntimeError("403 handshake")
        Path(path).write_bytes(b"ID3-audio")

    async def no_sleep(_seconds):
        return None

    monkeypatch.setattr(audio_service, "_speak_once", flaky_speak)
    monkeypatch.setattr(audio_service.asyncio, "sleep", no_sleep)

    asyncio.run(audio_service._speak("halo", "id-ID-ArdiNeural", str(out), attempts=3))

    assert len(attempts) == 2
    assert out.read_bytes() == b"ID3-audio"


def test_run_marks_audio_failed_and_removes_partial_file(
    db_session, make_subject, make_material, monkeypatch, tmp_path
):
    subject = make_subject("Audio")
    material = make_material(subject.id, status="Ready")
    out = tmp_path / "gagal.mp3"
    out.write_bytes(b"partial")

    rec = AudioGeneration(
        material_id=material.id,
        subject_id=subject.id,
        voice="id-ID-ArdiNeural",
        status="Processing",
        progress=0,
        stage="Mempersiapkan...",
        file_path=str(out),
    )
    db_session.add(rec)
    db_session.commit()
    db_session.refresh(rec)

    async def always_fail(*_args, **_kwargs):
        raise RuntimeError("403 dari Edge TTS")

    monkeypatch.setattr(audio_service, "_speak", always_fail)
    monkeypatch.setattr(
        audio_service,
        "SessionLocal",
        sessionmaker(bind=db_session.get_bind()),
    )

    audio_service._run(rec.id, "Teks pendek", "id-ID-ArdiNeural", str(out))

    db_session.expire_all()
    fresh = db_session.get(AudioGeneration, rec.id)
    assert fresh.status == "Failed"
    assert "Layanan TTS" in fresh.error
    assert fresh.stage == "Gagal"
    assert not os.path.exists(out)


def test_run_marks_ready_and_cleans_chunk_files(
    db_session, make_subject, make_material, monkeypatch, tmp_path
):
    subject = make_subject("Audio")
    material = make_material(subject.id, status="Ready")
    out = tmp_path / "selesai.mp3"
    chunk_paths = []

    async def fake_speak(_text, _voice, path):
        Path(path).write_bytes(b"ID3-chunk")
        chunk_paths.append(path)

    def fake_concat(paths, target):
        assert paths
        Path(target).write_bytes(b"ID3-final")

    monkeypatch.setattr(audio_service, "_speak", fake_speak)
    monkeypatch.setattr(audio_service, "_concat", fake_concat)
    monkeypatch.setattr(audio_service, "_duration_sec", lambda _path: 12)
    monkeypatch.setattr(
        audio_service,
        "SessionLocal",
        sessionmaker(bind=db_session.get_bind()),
    )

    rec = AudioGeneration(
        material_id=material.id,
        subject_id=subject.id,
        voice="id-ID-ArdiNeural",
        status="Processing",
        progress=0,
        stage="Mempersiapkan...",
        file_path=str(out),
    )
    db_session.add(rec)
    db_session.commit()
    db_session.refresh(rec)

    audio_service._run(rec.id, "Teks pendek", "id-ID-ArdiNeural", str(out))

    db_session.expire_all()
    fresh = db_session.get(AudioGeneration, rec.id)
    assert fresh.status == "Ready"
    assert fresh.progress == 100
    assert fresh.duration_sec == 12
    assert out.read_bytes() == b"ID3-final"
    assert chunk_paths and all(not os.path.exists(path) for path in chunk_paths)


def test_concat_uses_unique_list_file_and_removes_it(monkeypatch, tmp_path):
    seen = []

    def fake_run(cmd, **_kwargs):
        listfile = cmd[cmd.index("-i") + 1]
        seen.append(listfile)
        assert os.path.exists(listfile)

    monkeypatch.setattr(audio_service.subprocess, "run", fake_run)
    src = tmp_path / "chunk.mp3"
    src.write_bytes(b"x")
    audio_service._concat([str(src)], str(tmp_path / "out.mp3"))
    audio_service._concat([str(src)], str(tmp_path / "out2.mp3"))

    assert len(seen) == 2
    assert seen[0] != seen[1]
    assert all(not os.path.exists(path) for path in seen)
