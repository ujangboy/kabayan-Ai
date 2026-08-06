"""
Learning Profile Service — adaptive learning jangka panjang (Fase 2 Refined).

Bertanggung jawab:
  - Mengagregasi hasil ujian lintas-sesi menjadi profil mastery per mata kuliah
    (topics_mastery, weak/strong topics, estimated_level, topic_trend).
  - Membangun string {adaptive_instructions} yang aman untuk diinjeksi ke
    prompt blueprint & soal — dengan confidence threshold dan batasan mutlak
    agar tidak mengganggu skema JSON/parameter fundamental blueprint.
  - Menyediakan profile payload lengkap (termasuk trend) untuk UI.
  - Fungsi reset profil per subject.

Semua statistik murni Python — zero AI (pola sama dengan assessment_engine).

Perubahan v2:
  - MIN_CONFIDENCE_SESSIONS diturunkan ke 1 + partial-adaptive mode (1 sesi = soft hint).
  - Tambah topic_trend_json: {topic: [acc_sesi1, acc_sesi2, ...]} untuk tracking tren.
  - build_profile_section() menyertakan info tren naik/turun ke instruksi adaptif.
  - get_profile_payload() mengembalikan topic_trend untuk UI.
  - Tambah reset_profile() untuk membersihkan profil per subject.
  - Sinkronisasi ke TutorUserProfile diperbaiki agar subject-scoped (tidak campur matkul).
  - ingest_session() lebih robust: guard terhadap missing topic di ExamReview.
"""
import json
import logging
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from models import LearningProfile, ExamReview, ExamAttempt, ExamSession, Subject

logger = logging.getLogger(__name__)

USER_KEY = "local"

# ─── Confidence Threshold ─────────────────────────────────────────────────────
# Fase 2: diturunkan ke 1 sesi agar adaptive mulai bekerja sejak ujian pertama.
# Mode:
#   total_sessions == 0 → cold start, tidak ada injeksi (kembalikan "")
#   total_sessions == 1 → partial adaptive (soft hint, instruksi minimal)
#   total_sessions >= 2 → full adaptive (instruksi lengkap + batasan mutlak)
MIN_CONFIDENCE_SESSIONS = 1
FULL_ADAPTIVE_SESSIONS  = 2

# Batas klasifikasi akurasi (selaras assessment_engine: >= 70 → kuat)
STRONG_ACCURACY = 70

# ─── Batasan Mutlak untuk prompt adaptif ──────────────────────────────────────
_ADAPTIVE_BOUNDARY = (
    "PENTING — BATASAN MUTLAK:\n"
    "1. Instruksi adaptif ini TIDAK BOLEH mengubah skema JSON output.\n"
    "2. TIDAK BOLEH mengubah jumlah total soal maupun total weight_percent (harus tetap 100).\n"
    "3. TIDAK BOLEH mengubah parameter fundamental blueprint yang dipilih user "
    "(exam_type, question_type, bloom_level, difficulty).\n"
    "4. Instruksi ini HANYA boleh memengaruhi distribusi bobot antar topik dan "
    "tingkat kesulitan/bloom internal per topik."
)
MAX_SECTION_CHARS = 1400  # sedikit dinaikkan untuk akomodasi info trend


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _load_json(text: Optional[str], fallback):
    if not text:
        return fallback
    try:
        data = json.loads(text)
        return data if data is not None else fallback
    except (json.JSONDecodeError, TypeError):
        logger.warning("LearningProfile JSON tidak valid: %r", str(text)[:100])
        return fallback


def _trend_direction(trend_list: List[float]) -> str:
    """
    Hitung arah tren dari list akurasi per sesi.
    Mengembalikan: '↑ meningkat', '↓ menurun', atau '→ stabil'.
    Butuh minimal 2 data poin untuk mendeteksi tren.
    """
    if len(trend_list) < 2:
        return ""
    # Hitung linear trend: rata-rata separuh akhir vs separuh awal
    half = max(1, len(trend_list) // 2)
    first_half = sum(trend_list[:half]) / half
    second_half = sum(trend_list[half:]) / (len(trend_list) - half)
    delta = second_half - first_half
    if delta >= 5:
        return "↑"   # naik >= 5% → positif
    elif delta <= -5:
        return "↓"   # turun >= 5% → butuh perhatian
    return "→"


def _topic_stats_with_trend(
    db: Session, subject_id: int
) -> Tuple[Dict[str, dict], Dict[str, List[float]]]:
    """
    Hitung statistik per topik dari SEMUA review ujian subject tsb,
    sekaligus bangun trend akurasi per sesi per topik.

    Return:
        stats : {topic: {"attempts": int, "correct": int, "sessions": int, "accuracy": int}}
        trend : {topic: [akurasi_sesi1, akurasi_sesi2, ...]}  # urutan kronologis
    """
    # Ambil semua review, join ke attempt dan session, urutkan berdasarkan session.started_at
    rows = (
        db.query(ExamReview)
        .join(ExamAttempt, ExamReview.attempt_id == ExamAttempt.id)
        .join(ExamSession, ExamAttempt.session_id == ExamSession.id)
        .filter(ExamSession.subject_id == subject_id)
        .order_by(ExamSession.started_at)
        .all()
    )

    stats: Dict[str, dict] = {}
    seen_sessions: Dict[str, set] = {}

    # Untuk trend: {topic: {session_id: {"correct": int, "total": int}}}
    trend_raw: Dict[str, Dict[int, dict]] = {}
    # Track urutan session untuk sort kronologis
    session_order: Dict[int, int] = {}
    session_counter = 0

    for r in rows:
        # Fallback untuk topic kosong
        topic = (r.topic or "").strip() or "Umum"
        session_id = r.attempt.session_id

        # Pastikan session terdaftar dalam order tracking
        if session_id not in session_order:
            session_order[session_id] = session_counter
            session_counter += 1

        # ── Statistik global per topik ──
        entry = stats.setdefault(topic, {"attempts": 0, "correct": 0, "sessions": 0})
        entry["attempts"] += 1
        if r.is_correct:
            entry["correct"] += 1
        seen_sessions.setdefault(topic, set()).add(session_id)

        # ── Trend per sesi ──
        sess_data = trend_raw.setdefault(topic, {}).setdefault(
            session_id, {"correct": 0, "total": 0}
        )
        sess_data["total"] += 1
        if r.is_correct:
            sess_data["correct"] += 1

    # Finalize stats
    for topic, entry in stats.items():
        entry["sessions"] = len(seen_sessions.get(topic, set()))
        entry["accuracy"] = (
            round(entry["correct"] / entry["attempts"] * 100)
            if entry["attempts"] else 0
        )

    # Bangun trend list (diurutkan kronologis berdasarkan session_order)
    trend: Dict[str, List[float]] = {}
    for topic, session_map in trend_raw.items():
        sorted_sessions = sorted(session_map.keys(), key=lambda sid: session_order.get(sid, 0))
        trend[topic] = [
            round(session_map[sid]["correct"] / session_map[sid]["total"] * 100)
            if session_map[sid]["total"] else 0
            for sid in sorted_sessions
        ]

    return stats, trend


# ─── CRUD ────────────────────────────────────────────────────────────────────

def get_or_create(db: Session, subject_id: int) -> LearningProfile:
    profile = (
        db.query(LearningProfile)
        .filter_by(user_key=USER_KEY, subject_id=subject_id)
        .first()
    )
    if profile is None:
        profile = LearningProfile(user_key=USER_KEY, subject_id=subject_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def ingest_session(db: Session, session_id: int) -> LearningProfile:
    """
    Agregasi hasil ujian ke profil belajar jangka panjang.

    PENTING: Pastikan ExamReview sudah di-commit ke DB sebelum memanggil fungsi ini.

    Idempoten: dihitung ulang dari seluruh review ujian subject, sehingga
    pemanggilan ganda untuk sesi yang sama tidak menggandakan data.

    Perubahan v2:
    - Menyimpan topic_trend_json (history akurasi per sesi per topik).
    - Partial adaptive: 1 sesi = profil sudah terbentuk (soft), ≥2 = full.
    - Guard: topic kosong di ExamReview → fallback ke "Umum".
    """
    session = db.query(ExamSession).filter(ExamSession.id == session_id).first()
    if not session:
        raise ValueError(f"Sesi ujian ID {session_id} tidak ditemukan.")
    subject_id = session.subject_id

    profile = get_or_create(db, subject_id)
    stats, trend = _topic_stats_with_trend(db, subject_id)

    if not stats:
        logger.info("ingest_session: Tidak ada ExamReview untuk subject %d, skip.", subject_id)
        return profile

    mastery: Dict[str, dict] = {}
    weak, strong = [], []

    for topic, s in stats.items():
        mastery[topic] = {
            "accuracy":  s["accuracy"],
            "attempts":  s["attempts"],
            "sessions":  s["sessions"],
        }
        # Mulai klasifikasi sejak 1 sesi (MIN_CONFIDENCE_SESSIONS = 1)
        if s["sessions"] >= MIN_CONFIDENCE_SESSIONS:
            if s["accuracy"] >= STRONG_ACCURACY:
                strong.append(topic)
            else:
                weak.append(topic)

    completed_count = (
        db.query(ExamSession)
        .filter(
            ExamSession.subject_id == subject_id,
            ExamSession.submitted_at.isnot(None),
        )
        .count()
    )
    total_questions = sum(s["attempts"] for s in stats.values())
    total_correct   = sum(s["correct"]  for s in stats.values())

    profile.topics_mastery   = json.dumps(mastery, ensure_ascii=False)
    profile.weak_topics      = json.dumps(weak,    ensure_ascii=False)
    profile.strong_topics    = json.dumps(strong,  ensure_ascii=False)
    profile.topic_trend_json = json.dumps(trend,   ensure_ascii=False)
    profile.total_sessions   = completed_count
    profile.total_questions  = total_questions
    profile.total_correct    = total_correct

    # estimated_level: hitung sejak 1 sesi (tidak perlu threshold 2 lagi)
    if total_questions > 0:
        weighted = sum(s["accuracy"] * s["attempts"] for s in stats.values())
        profile.estimated_level = round(weighted / total_questions)
    elif profile.estimated_level is None:
        profile.estimated_level = 0

    db.commit()
    db.refresh(profile)

    logger.info(
        "ingest_session: Subject %d — %d sesi, %d soal, level=%d, weak=%s, strong=%s",
        subject_id, completed_count, total_questions,
        profile.estimated_level, weak, strong,
    )

    # ── Sync ke TutorUserProfile (subject-scoped) ──────────────────────────
    # Kirim subject_id agar sinkronisasi tidak mencampur topik antar matkul.
    try:
        if weak or strong:
            from services.tutor_profile_service import update_topics_for_subject
            update_topics_for_subject(db, subject_id, weak, strong)
    except Exception as exc:
        logger.warning("Sync weak/strong topics ke TutorUserProfile gagal: %s", exc)

    return profile


def reset_profile(db: Session, subject_id: int) -> LearningProfile:
    """
    Reset profil adaptif per mata kuliah ke kondisi kosong (cold start).
    Berguna jika data korup atau user ingin mulai ulang tracking.

    ExamReview & ExamSession TIDAK dihapus — hanya profil adaptif yang direset.
    Setelah reset, ingest_session() dapat dipanggil ulang untuk recalculate.
    """
    profile = get_or_create(db, subject_id)
    profile.topics_mastery   = None
    profile.weak_topics      = None
    profile.strong_topics    = None
    profile.topic_trend_json = None
    profile.estimated_level  = 0
    profile.total_sessions   = 0
    profile.total_questions  = 0
    profile.total_correct    = 0
    db.commit()
    db.refresh(profile)
    logger.info("reset_profile: Profil adaptif subject %d berhasil direset.", subject_id)
    return profile


def recalculate_profile(db: Session, subject_id: int) -> LearningProfile:
    """
    Hitung ulang profil dari seluruh ExamReview yang ada.
    Berguna setelah reset atau jika data tidak sinkron.
    """
    # Cari sesi terakhir yang sudah di-submit untuk subject ini
    last_session = (
        db.query(ExamSession)
        .filter(
            ExamSession.subject_id == subject_id,
            ExamSession.submitted_at.isnot(None),
        )
        .order_by(ExamSession.submitted_at.desc())
        .first()
    )
    if not last_session:
        # Tidak ada sesi → kembalikan profil kosong
        return get_or_create(db, subject_id)
    return ingest_session(db, last_session.id)


# ─── Payload untuk UI ─────────────────────────────────────────────────────────

def get_profile_payload(db: Session, subject_id: int) -> dict:
    """
    Kembalikan profil siap-render, termasuk data trend per topik.
    Cold start → default aman, bukan error.
    """
    profile = get_or_create(db, subject_id)
    mastery = _load_json(profile.topics_mastery, {})
    weak    = _load_json(profile.weak_topics, [])
    strong  = _load_json(profile.strong_topics, [])
    trend   = _load_json(profile.topic_trend_json, {})

    has_data = bool(profile.total_questions) or bool(mastery)

    # Bangun summary trend untuk tiap topik (naik/turun/stabil + akurasi terkini)
    topic_trend_summary: Dict[str, dict] = {}
    for topic, acc_list in (trend.items() if isinstance(trend, dict) else {}.items()):
        if not isinstance(acc_list, list) or not acc_list:
            continue
        topic_trend_summary[topic] = {
            "trend":          _trend_direction(acc_list),
            "history":        acc_list,
            "latest_accuracy": acc_list[-1] if acc_list else 0,
            "sessions_count":  len(acc_list),
        }

    return {
        "subject_id":        subject_id,
        "has_data":          has_data,
        "status":            "Belum ada data evaluasi" if not has_data else "Siap",
        "estimated_level":   profile.estimated_level or 0,
        "topics_mastery":    mastery if isinstance(mastery, dict) else {},
        "weak_topics":       weak    if isinstance(weak,   list)  else [],
        "strong_topics":     strong  if isinstance(strong, list)  else [],
        "topic_trend":       topic_trend_summary,
        "total_sessions":    profile.total_sessions   or 0,
        "total_questions":   profile.total_questions  or 0,
        "total_correct":     profile.total_correct    or 0,
        "confidence_threshold": MIN_CONFIDENCE_SESSIONS,
        "mode":              (
            "full"    if (profile.total_sessions or 0) >= FULL_ADAPTIVE_SESSIONS
            else "partial" if (profile.total_sessions or 0) >= MIN_CONFIDENCE_SESSIONS
            else "cold_start"
        ),
        "updated_at":        profile.updated_at.isoformat() if profile.updated_at else None,
    }


# ─── Prompt section ───────────────────────────────────────────────────────────

def build_profile_section(db: Session, subject_id: int) -> str:
    """
    Bangun string {adaptive_instructions} untuk prompt blueprint & soal.

    Mode:
      - cold start (0 sesi)   → kembalikan "" agar prompt tidak berubah.
      - partial (1 sesi)      → hint ringan (tanpa batasan mutlak, agar LLM
                                tidak terlalu patuh saat data masih sedikit).
      - full (≥ 2 sesi)       → instruksi lengkap + BATASAN MUTLAK.

    Menyertakan info tren (naik/turun) untuk soal yang lebih relevan.
    """
    profile = get_or_create(db, subject_id)

    if (profile.total_sessions or 0) < MIN_CONFIDENCE_SESSIONS:
        return ""   # cold start

    mastery = _load_json(profile.topics_mastery, {})
    weak    = _load_json(profile.weak_topics,    [])
    strong  = _load_json(profile.strong_topics,  [])
    trend   = _load_json(profile.topic_trend_json, {})

    if not weak and not strong:
        return ""

    is_full = (profile.total_sessions or 0) >= FULL_ADAPTIVE_SESSIONS

    lines = [
        "\n\n==================================================",
        "CATATAN ADAPTIF (PROFIL BELAJAR SISWA)",
        "==================================================",
    ]

    if is_full:
        lines.append(
            f"[Data dari {profile.total_sessions} sesi ujian, "
            f"estimasi level {profile.estimated_level}/100]"
        )
    else:
        lines.append("[Data awal — 1 sesi ujian, gunakan sebagai petunjuk ringan]")

    # ── Topik Lemah ──
    if weak:
        weak_desc = []
        for t in weak[:5]:
            acc = mastery.get(t, {}).get("accuracy", "?")
            t_trend = trend.get(t, [])
            direction = _trend_direction(t_trend) if len(t_trend) >= 2 else ""
            desc = f"{t} (akurasi {acc}%{' ' + direction if direction else ''})"
            weak_desc.append(desc)
        lines.append(
            "- Topik yang MASIH LEMAH: " + ", ".join(weak_desc) +
            ". Pertimbangkan memberi bobot lebih dan soal dengan tingkat kesulitan yang sesuai untuk topik ini."
        )

    # ── Topik Kuat ──
    if strong:
        strong_desc = []
        for t in strong[:5]:
            acc = mastery.get(t, {}).get("accuracy", "?")
            t_trend = trend.get(t, [])
            direction = _trend_direction(t_trend) if len(t_trend) >= 2 else ""
            desc = f"{t} (akurasi {acc}%{' ' + direction if direction else ''})"
            strong_desc.append(desc)
        lines.append(
            "- Topik yang SUDAH DIKUASAI: " + ", ".join(strong_desc) +
            ". Pertimbangkan menaikkan tingkat kesulitan atau level Bloom (analisis/evaluasi) untuk topik ini."
        )

    if profile.estimated_level:
        lines.append(f"- Estimasi level siswa: {profile.estimated_level}/100.")

    # Batasan mutlak hanya disertakan di full mode
    if is_full:
        lines.append(_ADAPTIVE_BOUNDARY)

    section = "\n".join(lines)
    return section[:MAX_SECTION_CHARS]
