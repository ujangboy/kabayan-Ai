"""
Learning Profile Service — adaptive learning jangka panjang.

Fokus uji:
  - Cold start → payload aman (estimated_level 0, mastery {}, bukan error)
  - Partial-adaptive (v2): 1 sesi sudah mengklasifikasi weak/strong (MIN=1)
  - build_profile_section → "" saat data kurang, memuat BATASAN MUTLAK saat ada data
  - Sync weak/strong topics ke TutorUserProfile (format tagged per subject)
"""
import json
import datetime

import pytest

from models import ExamSession, ExamAttempt, ExamReview, TutorUserProfile, Subject
from services.learning_profile_service import (
    get_or_create,
    ingest_session,
    get_profile_payload,
    build_profile_section,
    MIN_CONFIDENCE_SESSIONS,
    _ADAPTIVE_BOUNDARY,
    MAX_SECTION_CHARS,
)
from routers.exam_analyzer import get_learning_profile, submit_exam
from exceptions import AppError


# ─── Endpoint integration ────────────────────────────────────────────────────

def test_get_learning_profile_endpoint_cold_start(db_session, make_subject):
    import asyncio
    from fastapi.responses import JSONResponse
    subject = make_subject("Matkul Endpoint")

    resp = asyncio.run(get_learning_profile(subject.id, db_session))
    assert isinstance(resp, JSONResponse)
    body = json.loads(resp.body)

    assert body["has_data"] is False
    assert body["estimated_level"] == 0
    assert body["topics_mastery"] == {}


def test_get_learning_profile_endpoint_404_unknown_subject(db_session):
    import asyncio
    with pytest.raises(AppError) as exc_info:
        asyncio.run(get_learning_profile(99999, db_session))
    assert exc_info.value.status_code == 404


def test_submit_exam_ingests_profile(db_session, make_subject, monkeypatch):
    """Hook submit_exam: setelah evaluasi, profil belajar ikut ter-agregasi."""
    import asyncio
    from services import exam_service as es_mod
    from services import subject_service as subj_mod
    from routers import exam_analyzer as ea_mod

    subject = make_subject("Matkul Hook")

    session = ExamSession(subject_id=subject.id, status="active", questions_json="{}")
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    attempt = ExamAttempt(session_id=session.id, attempt_number=1, score=60)
    db_session.add(attempt)
    db_session.commit()
    db_session.refresh(attempt)

    db_session.add(ExamReview(
        attempt_id=attempt.id, question_number=1,
        topic="Looping", question_text="Q", is_correct=0,
    ))
    db_session.commit()

    # Evaluasi ter-stub → tidak butuh substansi ujian asli.
    monkeypatch.setattr(es_mod.exam_service, "submit_and_evaluate",
                        lambda db, sid, answers: {"score": 60})

    class _FakeRepo:
        def __init__(self, s):
            self.s = s
        def get(self, db, sid):
            return self.s
    from repositories import exam_repository as exam_repo_mod
    monkeypatch.setattr(exam_repo_mod, "exam_session_repository", _FakeRepo(session))

    class _FakeSubjSvc:
        def recalculate_subject_stats(self, db, subject_id):
            return None
    monkeypatch.setattr(subj_mod, "subject_service", _FakeSubjSvc())

    from schemas.exam import SubmitAnswersRequest
    resp = asyncio.run(submit_exam(session.id, SubmitAnswersRequest(answers={"1": "A"}), db_session))
    assert resp.status_code == 200

    profile = get_or_create(db_session, subject.id)
    assert profile.total_questions == 1
    assert profile.subject_id == subject.id


def _make_completed_session(db, subject_id, reviews, submitted=True):
    """Sesi ujian lengkap: session → attempt → reviews [(topic, is_correct), ...]"""
    session = ExamSession(
        subject_id=subject_id,
        status="completed",
        submitted_at=datetime.datetime.utcnow() if submitted else None,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    attempt = ExamAttempt(session_id=session.id, attempt_number=1, score=50)
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    for topic, is_correct in reviews:
        db.add(ExamReview(
            attempt_id=attempt.id,
            question_number=1,
            topic=topic,
            question_text="Q",
            is_correct=1 if is_correct else 0,
        ))
    db.commit()
    return session


# ─── Cold start ──────────────────────────────────────────────────────────────

def test_get_profile_payload_cold_start_safe(db_session, make_subject):
    subject = make_subject("Matkul Baru")

    payload = get_profile_payload(db_session, subject.id)

    assert payload["has_data"] is False
    assert payload["estimated_level"] == 0
    assert payload["topics_mastery"] == {}
    assert payload["weak_topics"] == []
    assert payload["strong_topics"] == []
    assert payload["status"] == "Belum ada data evaluasi"


def test_get_or_create_creates_default(db_session, make_subject):
    subject = make_subject("Matkul Baru")
    profile = get_or_create(db_session, subject.id)

    assert profile.user_key == "local"
    assert profile.subject_id == subject.id
    assert profile.estimated_level == 0
    assert profile.total_sessions == 0


# ─── Confidence threshold ────────────────────────────────────────────────────

def test_ingest_single_session_triggers_partial_classification(db_session, make_subject):
    """1 sesi → weak/strong TERISI (v2 partial-adaptive, MIN_CONFIDENCE_SESSIONS=1)."""
    subject = make_subject("Matkul Satu Sesi")
    _make_completed_session(db_session, subject.id, [
        ("Looping", True), ("Looping", False), ("Percabangan", True),
    ])

    profile = ingest_session(db_session, 1)

    assert profile.total_sessions == 1
    assert profile.total_questions == 3
    # Akurasi: Looping 50% (<70 → lemah), Percabangan 100% (≥70 → kuat)
    weak = json.loads(profile.weak_topics)
    strong = json.loads(profile.strong_topics)
    assert "Looping" in weak
    assert "Percabangan" in strong

    mastery = json.loads(profile.topics_mastery)
    assert mastery["Looping"]["accuracy"] == 50
    assert mastery["Looping"]["sessions"] == 1
    # weighted = (50*2 + 100*1) / 3 = 66.67 → 67
    assert profile.estimated_level == 67


def test_ingest_meets_confidence_threshold_classifies(db_session, make_subject):
    """2+ sesi per topik → weak/strong terisi sesuai ambang akurasi 70."""
    subject = make_subject("Matkul Dua Sesi")
    # Sesi 1: Looping 0/2 benar (lemah), Percabangan 2/2 benar (kuat)
    _make_completed_session(db_session, subject.id, [
        ("Looping", False), ("Looping", False), ("Percabangan", True), ("Percabangan", True),
    ])
    # Sesi 2: Looping 0/1, Percabangan 1/1
    _make_completed_session(db_session, subject.id, [
        ("Looping", False), ("Percabangan", True),
    ])

    profile = ingest_session(db_session, 1)

    assert profile.total_sessions == 2
    weak = json.loads(profile.weak_topics)
    strong = json.loads(profile.strong_topics)
    assert "Looping" in weak
    assert "Percabangan" in strong

    mastery = json.loads(profile.topics_mastery)
    assert mastery["Looping"]["accuracy"] == 0
    assert mastery["Looping"]["sessions"] == 2
    assert mastery["Percabangan"]["accuracy"] == 100

    # estimated_level = akurasi terbobot attempts: (0*3 + 100*3)/6 = 50
    assert profile.estimated_level == 50


def test_ingest_is_idempotent(db_session, make_subject):
    """Ingest dua kali untuk sesi sama → tidak menggandakan data."""
    subject = make_subject("Matkul Idempoten")
    session = _make_completed_session(db_session, subject.id, [
        ("Looping", False), ("Looping", True),
    ])

    ingest_session(db_session, session.id)
    ingest_session(db_session, session.id)

    profile = get_or_create(db_session, subject.id)
    mastery = json.loads(profile.topics_mastery)
    assert mastery["Looping"]["attempts"] == 2  # bukan 4


# ─── build_profile_section ───────────────────────────────────────────────────

def test_build_profile_section_empty_on_cold_start(db_session, make_subject):
    subject = make_subject("Matkul Baru")
    assert build_profile_section(db_session, subject.id) == ""


def test_build_profile_section_contains_boundary(db_session, make_subject):
    subject = make_subject("Matkul Ada Data")
    s1 = _make_completed_session(db_session, subject.id, [
        ("Looping", False), ("Percabangan", True),
    ])
    s2 = _make_completed_session(db_session, subject.id, [
        ("Looping", False), ("Percabangan", True),
    ])
    ingest_session(db_session, s2.id)

    section = build_profile_section(db_session, subject.id)

    assert section != ""
    assert "Looping" in section
    assert "Percabangan" in section
    # Batasan mutlak (penyesuaian #2) harus selalu ada
    assert _ADAPTIVE_BOUNDARY in section
    assert "TIDAK BOLEH mengubah skema JSON" in section
    assert len(section) <= MAX_SECTION_CHARS


# ─── Sync ke profil tutor ────────────────────────────────────────────────────

def test_ingest_syncs_tutor_profile(db_session, make_subject):
    subject = make_subject("Matkul Tutor")
    _make_completed_session(db_session, subject.id, [
        ("Looping", False), ("Percabangan", True),
    ])
    _make_completed_session(db_session, subject.id, [
        ("Looping", False), ("Percabangan", True),
    ])

    ingest_session(db_session, 1)

    tutor = db_session.query(TutorUserProfile).filter_by(user_key="local").first()
    assert tutor is not None
    # Format v2: tagged per subject — {"subject_id": int, "topics": [str]}
    weak = json.loads(tutor.weak_topics)
    strong = json.loads(tutor.strong_topics)
    weak_entry = next((e for e in weak if isinstance(e, dict) and e.get("subject_id") == subject.id), None)
    strong_entry = next((e for e in strong if isinstance(e, dict) and e.get("subject_id") == subject.id), None)
    assert weak_entry is not None
    assert strong_entry is not None
    assert "Looping" in weak_entry["topics"]
    assert "Percabangan" in strong_entry["topics"]


# ─── Tutor chat sadar per mata kuliah ────────────────────────────────────────

def test_adaptive_section_prioritizes_subject_profile(db_session):
    """Jika subject_profile ada, topik matkul itu DIPRIORITASKAN (tidak campur global)."""
    from services.tutor_profile_service import get_or_create_profile, build_adaptive_prompt_section
    profile = get_or_create_profile(db_session)
    profile.weak_topics = json.dumps(["GlobalTopicLain"])
    db_session.commit()

    subject_profile = {"subject": "Matematika", "weak": ["Looping"], "strong": ["Percabangan"]}
    section = build_adaptive_prompt_section(profile, subject_profile=subject_profile)

    assert "Looping" in section
    assert "Percabangan" in section
    assert "GlobalTopicLain" not in section


def test_adaptive_section_falls_back_to_global(db_session):
    """Tanpa subject_profile → perilaku lama: pakai daftar global."""
    from services.tutor_profile_service import get_or_create_profile, build_adaptive_prompt_section
    profile = get_or_create_profile(db_session)
    profile.weak_topics = json.dumps(["GlobalTopic"])
    db_session.commit()

    section = build_adaptive_prompt_section(profile)
    assert "GlobalTopic" in section


def test_find_subject_learning_profile_matches_case_insensitive(db_session, make_subject):
    from services.tutor_service import _find_subject_learning_profile
    from services.learning_profile_service import get_or_create

    subject = make_subject("Matematika")
    lp = get_or_create(db_session, subject.id)
    lp.weak_topics = json.dumps(["Limit"])
    lp.strong_topics = json.dumps(["Turunan"])
    lp.total_sessions = 3
    db_session.commit()

    found = _find_subject_learning_profile(db_session, "matematika")
    assert found is not None
    assert found["subject"] == "Matematika"
    assert "Limit" in found["weak"]
    assert "Turunan" in found["strong"]


def test_find_subject_learning_profile_none_without_data(db_session, make_subject):
    from services.tutor_service import _find_subject_learning_profile

    subject = make_subject("Fisika")
    assert _find_subject_learning_profile(db_session, "Fisika") is None
    assert _find_subject_learning_profile(db_session, "Tidak Ada") is None
    assert _find_subject_learning_profile(db_session, None) is None


def test_build_tutor_prompt_includes_subject_adaptive(db_session):
    from services.tutor_profile_service import get_or_create_profile
    from prompts.tutor import build_tutor_prompt

    profile = get_or_create_profile(db_session)
    subject_profile = {"subject": "Matematika", "weak": ["Logaritma"], "strong": []}

    prompt = build_tutor_prompt("intermediate", profile=profile, subject_profile=subject_profile)
    template_str = prompt.template

    assert "Logaritma" in template_str
    assert "mata_kuliah" in prompt.input_variables
