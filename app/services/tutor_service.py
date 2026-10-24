"""
Tutor Service — orchestrates the hybrid routing pipeline for Kabayan AI Tutor.

Flow per request:
  1. classify(message)  → SIMPLE / MEDIUM / COMPLEX
  2. SIMPLE  → faq_service.find_best_match() → wrap with TUTOR_FAQ_WRAPPER_PROMPT → stream
  3. MEDIUM  → achat_stream with tutor prompt (standard Groq model via "chat" capability)
  4. COMPLEX → achat_stream with tutor prompt (stronger Groq model via "reasoning" capability)

All responses stream as plain text (same as /api/chat).
Message persistence (type + tokens_used) is handled by the router after streaming.
"""
from __future__ import annotations

import logging
from typing import AsyncIterator, Optional


def _record_usage_safe(db: Session, feature: str, response_text: str | None) -> None:
    """Catat usage lalu tutup session (untuk task background fire-and-forget)."""
    try:
        from app.services.usage_service import record_usage
        record_usage(db, feature, response_text)
    finally:
        try:
            db.close()
        except Exception:
            pass

from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from sqlalchemy.orm import Session

from app import config
from app.services.ai_service import ai_service, _normalize_math, _trim_history, _wrap_data
from app.services.tutor_classifier import classify, TierType
from app.services.faq_service import faq_service
from app.services.tutor_profile_service import get_or_create_profile
from app.services.cache_service import cache_service
from app.services.rag_context_service import rag_context_service
from app.agents.retrieval_agent import retrieval_agent
from app.prompts.tutor import build_tutor_prompt

logger = logging.getLogger(__name__)

# ─── Capability mapping ───────────────────────────────────────────────────────
# MEDIUM  → "chat"      capability (standard model, free tier)
# COMPLEX → "reasoning" capability (stronger model, still free tier via Groq)

TIER_CAPABILITY: dict[TierType, str] = {
    "SIMPLE": "chat",      # only used for FAQ wrapper — very short
    "MEDIUM": "chat",
    "COMPLEX": "reasoning",
}


def _find_subject_learning_profile(db: Session, mata_kuliah: Optional[str]) -> Optional[dict]:
    """
    Ambil topik lemah/kuat dari LearningProfile mata kuliah yang sedang dibahas.

    Matching nama mata kuliah (case-insensitive). Kembalikan None jika belum
    ada data ujian → tutor jatuh ke profil global (perilaku lama).
    """
    if not mata_kuliah or not str(mata_kuliah).strip():
        return None
    try:
        import json
        from sqlalchemy import func
        from app.models import Subject, LearningProfile

        name = str(mata_kuliah).strip()
        subject = db.query(Subject).filter(func.lower(Subject.name) == name.lower()).first()
        if not subject:
            return None
        lp = db.query(LearningProfile).filter_by(user_key="local", subject_id=subject.id).first()
        if not lp or not lp.total_sessions:
            return None
        weak = json.loads(lp.weak_topics or "[]")
        strong = json.loads(lp.strong_topics or "[]")
        if not isinstance(weak, list):
            weak = []
        if not isinstance(strong, list):
            strong = []
        if not weak and not strong:
            return None
        return {"subject": subject.name, "weak": weak, "strong": strong}
    except Exception as exc:
        logger.warning("Lookup LearningProfile per matkul gagal: %s", exc)
        return None


def _collect_doc_ids(db: Session, mata_kuliah: Optional[str], rag_docs: Optional[list[str]]) -> list[str]:
    """Kumpulkan doc_id materi aktif (Ready) dari mata kuliah + rag_docs manual."""
    doc_ids: list[str] = []
    try:
        from sqlalchemy import func
        from app.models import Subject

        if mata_kuliah and str(mata_kuliah).strip():
            name = str(mata_kuliah).strip()
            subject = db.query(Subject).filter(func.lower(Subject.name) == name.lower()).first()
            if subject and hasattr(subject, 'materials'):
                doc_ids.extend(
                    f"mat_{m.id}" for m in subject.materials
                    if getattr(m, 'status', None) == "Ready"
                )
    except Exception as exc:
        logger.debug("collect doc_ids matkul gagal: %s", exc)

    if rag_docs:
        for d in rag_docs:
            if str(d).startswith("mat_") and d not in doc_ids:
                doc_ids.append(d)
    return doc_ids


def _gather_tutor_context(db: Session, mata_kuliah: Optional[str], query: str, max_words: int = 800, rag_docs: list[str] = None) -> str:
    """
    Ambil potongan materi upload dari mata kuliah yang sedang dibahas dan/atau rag_docs manual.
    """
    try:
        from sqlalchemy import func
        from app.models import Subject

        ready_materials = []
        if mata_kuliah and str(mata_kuliah).strip():
            name = str(mata_kuliah).strip()
            subject = db.query(Subject).filter(func.lower(Subject.name) == name.lower()).first()
            if subject and hasattr(subject, 'materials'):
                ready_materials.extend([m for m in subject.materials if getattr(m, 'status', None) == "Ready"])
        
        # Tambahkan secara manual jika rag_docs disertakan
        if rag_docs:
            from app.models import Material
            # extract IDs: "mat_1" -> 1
            mat_ids = []
            for doc in rag_docs:
                if doc.startswith("mat_"):
                    try: mat_ids.append(int(doc.split("_")[1]))
                    except: pass
            if mat_ids:
                manual_mats = db.query(Material).filter(Material.id.in_(mat_ids), Material.status == "Ready").all()
                for m in manual_mats:
                    if m not in ready_materials:
                        ready_materials.append(m)

        if not ready_materials:
            return ""

        context = rag_context_service.gather_context(ready_materials, max_words=max_words, query=query)

        # Fallback: jika dynamic search tidak cukup, ambil semua chunk
        if not context or len(context.split()) < 100:
            all_chunks = rag_context_service._gather_chunks(
                [f"mat_{m.id}" for m in ready_materials], max_words
            )
            if all_chunks and len(all_chunks.split()) > len((context or "").split()):
                context = all_chunks

        return context if context else ""
    except Exception as exc:
        logger.debug("Tutor RAG context gather gagal: %s", exc)
        return ""


def _gather_exam_context(db: Session, exam_session_id: Optional[int]) -> str:
    """Bangun ringkasan hasil ujian untuk konteks tutor.

    Data diambil dari ExamSession (skor, topik lemah/kuat, evaluasi) + soal
    yang salah dari ExamReview. Dipakai agar tutor bisa menjawab pertanyaan
    seputar hasil ujian dengan konteks spesifik, bukan jawaban umum.
    """
    if not exam_session_id:
        return ""
    try:
        import json
        from app.models import ExamSession, ExamAttempt, ExamReview

        session = db.query(ExamSession).filter(ExamSession.id == exam_session_id).first()
        if not session or not session.submitted_at:
            return ""

        subject_name = session.subject_name or "Mata Kuliah"
        lines = [
            f"Mata kuliah: {subject_name}",
            f"Skor: {session.score or 0}/100",
            f"Benar: {session.total_correct or 0} · Salah: {session.total_wrong or 0}",
            f"Tipe: {session.exam_type or 'Simulasi'} · Soal: {session.total_questions or 0}",
        ]

        weak = []
        strong = []
        try:
            weak = json.loads(session.weak_topics_json or "[]")
            strong = json.loads(session.strong_topics_json or "[]")
        except Exception:
            pass
        if weak:
            try:
                topics = [t.get("topic", "") for t in weak if isinstance(t, dict) and t.get("topic")]
                if topics:
                    lines.append("Topik lemah: " + ", ".join(topics[:5]))
            except Exception:
                pass
        if strong:
            try:
                topics = [t.get("topic", "") for t in strong if isinstance(t, dict) and t.get("topic")]
                if topics:
                    lines.append("Topik kuat: " + ", ".join(topics[:5]))
            except Exception:
                pass

        # Ambil beberapa soal yang salah untuk dijadikan poin diskusi
        attempt = (
            db.query(ExamAttempt)
            .filter(ExamAttempt.session_id == exam_session_id)
            .order_by(ExamAttempt.attempt_number.desc())
            .first()
        )
        wrong_questions = []
        if attempt:
            wrong_reviews = (
                db.query(ExamReview)
                .filter(ExamReview.attempt_id == attempt.id, ExamReview.is_correct == 0)
                .order_by(ExamReview.id)
                .limit(5)
                .all()
            )
            for rv in wrong_reviews:
                snippet = (rv.question_text or "")[:120]
                topic = rv.topic or ""
                wrong_questions.append(f"- [Salah] {snippet}" + (f" (topik: {topic})" if topic else ""))
        if wrong_questions:
            lines.append("Soal yang dijawab salah:")
            lines.extend(wrong_questions)

        eval_feedback = ""
        try:
            eval_data = json.loads(session.evaluation_json or "{}")
            eval_feedback = (eval_data.get("overall_feedback") or eval_data.get("feedback") or "").strip()
        except Exception:
            pass
        if eval_feedback:
            lines.append(f"Umpan balik: {eval_feedback[:500]}")

        return "\n".join(lines)
    except Exception as exc:
        logger.debug("Exam context gather gagal: %s", exc)
        return ""


class TutorService:

    # ── Public streaming entry point ─────────────────────────────────────────

    async def achat_stream(
        self,
        db: Session,
        message: str,
        history: list[dict],
        mata_kuliah: Optional[str] = None,
        student_level: str = "intermediate",
        exam_session_id: Optional[int] = None,
        rag_docs: Optional[list[str]] = None,
    ) -> AsyncIterator[str]:
        """
        Main streaming coroutine for tutor chat.

        Yields:
            Text chunks (str).
            First chunk is special metadata header:
              "\x00TYPE:<type>\x00"   (e.g. "\x00TYPE:SIMPLE\x00")
            All subsequent chunks are regular response text.
        """
        # 1. Classify (bypass FAQ if it's a quick prompt to prevent repetitive templates)
        tier: TierType = "MEDIUM"
        if "ringkas" in message.lower() or "jelaskan" in message.lower() or "analogi" in message.lower():
            tier = "MEDIUM"
        else:
            classification = classify(message, history)
            tier = classification["type"]

        # Yield type header as the very first chunk so the router can read it
        yield f"\x00TYPE:{tier}\x00"

        # Load adaptive profile
        profile = get_or_create_profile(db)

        # 2. Route — history diteruskan ke semua rute (termasuk SIMPLE→MEDIUM escalation)
        if tier == "SIMPLE":
            async for chunk in self._handle_simple(
                db, message, history, mata_kuliah, student_level, profile=profile,
                exam_session_id=exam_session_id, rag_docs=rag_docs,
            ):
                yield chunk
        elif tier == "MEDIUM":
            async for chunk in self._handle_ai(
                db, message, history, mata_kuliah, student_level, capability="chat",
                profile=profile, exam_session_id=exam_session_id, rag_docs=rag_docs,
            ):
                yield chunk
        else:  # COMPLEX
            async for chunk in self._handle_ai(
                db, message, history, mata_kuliah, student_level, capability="reasoning",
                profile=profile, exam_session_id=exam_session_id, rag_docs=rag_docs,
            ):
                yield chunk

    # ── SIMPLE: FAQ lookup ────────────────────────────────────────────────────

    async def _handle_simple(
        self,
        db: Session,
        message: str,
        history: list[dict],
        mata_kuliah: Optional[str],
        student_level: str,
        profile=None,
        exam_session_id: Optional[int] = None,
        rag_docs: Optional[list[str]] = None,
    ) -> AsyncIterator[str]:
        """Look up FAQ. If material context available, wrap with AI to merge."""
        faq = faq_service.find_best_match(db, message, mata_kuliah=mata_kuliah)

        if faq is None:
            logger.debug("No FAQ match for '%s', escalating to MEDIUM.", message[:60])
            async for chunk in self._handle_ai(
                db, message, history, mata_kuliah, student_level, capability="chat",
                profile=profile, exam_session_id=exam_session_id, rag_docs=rag_docs,
            ):
                yield chunk
            return

        # Record usage (fire-and-forget, non-blocking)
        import asyncio
        asyncio.create_task(
            asyncio.to_thread(faq_service.record_usage, db, faq.id)
        )

        # Gather material context — jika ada, bungkus FAQ dengan konteks materi
        material_context = _gather_tutor_context(db, mata_kuliah, message, max_words=500, rag_docs=rag_docs)
        if not material_context:
            # Tidak ada materi upload → return FAQ langsung (0 token)
            yield faq.answer
            return

        # Ada material context → wrap FAQ + material via AI (1 permintaan ringan)
        from app.prompts.tutor import TUTOR_FAQ_WRAPPER_PROMPT
        wrapper = TUTOR_FAQ_WRAPPER_PROMPT.partial(material_context=(
            "KONTEKS MATERI KULIAH:\n<materi_kuliah>\n"
            f"{material_context}\n"
            "</materi_kuliah>\n"
            "Jika ada informasi di materi yang melengkapi jawaban, gunakan."
        ))
        wrapped = wrapper.format(
            mata_kuliah=mata_kuliah or "Umum",
            question=message,
            faq_answer=faq.answer,
            student_level=student_level,
        )

        llm = ai_service._get_llm("chat", max_tokens=500)
        messages = [SystemMessage(content=wrapped)]

        full_response = ""
        try:
            async for chunk in llm.astream(messages):
                if chunk.content:
                    full_response += chunk.content
                    yield chunk.content
        except Exception:
            # Fallback: return raw FAQ if AI wrapper fails
            yield faq.answer
            return

        _normalize_math(full_response)

        # Cache result
        import hashlib
        material_fp = hashlib.md5(material_context.encode()).hexdigest()[:8]
        cache_key = f"faq:{faq.id}:{student_level}:{material_fp}"
        try:
            cache_service.set_cache(db, cache_key, "", "", full_response)
        except Exception:
            pass

    # ── MEDIUM / COMPLEX: full AI response ────────────────────────────────────

    async def _handle_ai(
        self,
        db: Session,
        message: str,
        history: list[dict],
        mata_kuliah: Optional[str],
        student_level: str,
        capability: str,
        profile=None,
        exam_session_id: Optional[int] = None,
        rag_docs: Optional[list[str]] = None,
    ) -> AsyncIterator[str]:
        """Stream an AI tutor response using the Socratic prompt."""
        import time

        trimmed_history = _trim_history(history, max_turns=6)

        subject_profile = _find_subject_learning_profile(db, mata_kuliah)
        material_context = _gather_tutor_context(db, mata_kuliah, message, max_words=800, rag_docs=rag_docs)
        retrieval = retrieval_agent.run(message, _collect_doc_ids(db, mata_kuliah, rag_docs))
        if retrieval.context:
            material_context = retrieval.context
        exam_context = _gather_exam_context(db, exam_session_id)
        prompt_template = build_tutor_prompt(
            student_level, profile=profile, subject_profile=subject_profile,
            material_context=material_context, exam_context=exam_context,
        )
        wrapped_input = _wrap_data("pesan_siswa", message)

        # History dimasukkan sebagai objek pesan (Human/AI) di bawah — JANGAN
        # diulang di system prompt via {history} agar tidak membuang token
        # (double history sebelumnya memperlambat first-token).
        sys_content = prompt_template.format(
            mata_kuliah=mata_kuliah or "Umum",
            student_level=student_level,
            history="",
            input=wrapped_input,
        )

        # CRAG: retrieval tidak cukup → instruksi jujur + ajukan klarifikasi
        # (PRD US2.1: jangan memaksakan jawaban / menghalusinasi)
        if retrieval.needs_clarification and retrieval.status != "no_docs":
            sys_content += (
                "\n\nCATATAN RETRIEVAL (PENTING): Pencarian di materi kuliah user "
                "tidak menemukan informasi yang cukup untuk menjawab pertanyaan ini. "
                "JANGAN menebak atau mengarang jawaban dari materi yang tidak ada. "
                "Sampaikan bahwa informasi ini tidak ditemukan di materi yang "
                "diunggah, lalu bantu dengan pengetahuan umum yang relevan ATAU "
                "ajukan pertanyaan klarifikasi agar user bisa memperjelas atau "
                "mengunggah materi yang tepat."
            )

        messages = [SystemMessage(content=sys_content)]
        # Add history as proper message objects (last 10 turns)
        for msg in trimmed_history[-10:]:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            else:
                messages.append(AIMessage(content=msg["content"]))
        messages.append(HumanMessage(content=wrapped_input))

        llm = ai_service._get_llm(capability, max_tokens=1000)

        # Cache lookup — keyed by message + capability + level + subject + profil + material
        # (material_fp agar cache lama tanpa material context tidak dipakai)
        import hashlib
        profile_fp = hashlib.md5(
            f"{subject_profile}:{getattr(profile, 'weak_topics', '')}:{getattr(profile, 'strong_topics', '')}".encode()
        ).hexdigest()[:8]
        material_fp = hashlib.md5(material_context.encode()).hexdigest()[:8] if material_context else "none"
        exam_fp = hashlib.md5(exam_context.encode()).hexdigest()[:8] if exam_context else "none"
        cache_key = f"{message}:{capability}:{student_level}:{mata_kuliah or 'umum'}:{profile_fp}:{material_fp}:{exam_fp}:{retrieval.status}"
        cached = cache_service.get_cache(db, cache_key, "", "")
        if cached:
            yield _normalize_math(cached)
            return

        full_response = ""
        last_yield = time.time()

        try:
            async for chunk in llm.astream(messages):
                if chunk.content:
                    full_response += chunk.content
                    yield chunk.content
                    last_yield = time.time()
                elif time.time() - last_yield > 8:
                    yield ""
                    last_yield = time.time()
        except Exception as exc:
            err = str(exc).lower()
            if "401" in err or "invalid api key" in err or "invalid_api_key" in err or "authentication" in err:
                logging.error(f"[GROQ_AUTH_ERROR] Groq API key invalid: {exc}")
                yield "\n\nError: Groq API key tidak valid (401). Periksa file .env dan restart backend."
            elif any(x in err for x in ["timeout", "connection", "502", "503", "504"]):
                yield "\n\nError: Koneksi ke AI terputus. Coba kirim pesan lagi."
            elif "rate limit" in err or "429" in err:
                yield "\n\nError: Limit API tercapai. Tunggu sebentar lalu coba lagi."
            elif any(x in err for x in [
                "413", "request too large", "tokens per minute", "tokens_exceeded",
                "tpm", "context_length_exceeded", "context length", "payload too large"
            ]):
                yield ("\n\n⚠️ Konteks terlalu panjang (batas 8000 token/menit untuk model ini). "
                       "Coba: 1) kurangi dokumen terpilih, 2) mulai chat baru, "
                       "3) ringkas pertanyaanmu.")
            else:
                logging.error(f"[TUTOR_STREAM_ERROR] {exc}")
                yield "\n\n⚠️ Terjadi kesalahan saat memproses respons. Silakan coba lagi."
            return

        # Normalize math delimiters on complete response (same as ai_service)
        _normalize_math(full_response)

        # Catat pemakaian Groq untuk fitur tutor (agregat global).
        try:
            from app.services.usage_service import record_usage
            import asyncio as _asyncio
            from app.database import SessionLocal
            _rec_db = SessionLocal()
            _asyncio.create_task(
                _asyncio.to_thread(_record_usage_safe, _rec_db, "tutor", full_response)
            )
        except Exception:
            pass  # pencatatan usage non-kritikal

        # Cache the response for future identical queries
        try:
            cache_service.set_cache(db, cache_key, "", "", full_response)
        except Exception:
            pass  # cache failure is non-critical

    # ── Classification only (for /api/tutor/classify endpoint) ───────────────

    def classify_message(
        self, message: str, history: list[dict] | None = None
    ) -> dict:
        return classify(message, history or [])


tutor_service = TutorService()
