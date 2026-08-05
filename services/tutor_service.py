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

from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from sqlalchemy.orm import Session

import config
from services.ai_service import ai_service, _normalize_math, _trim_history, _wrap_data
from services.tutor_classifier import classify, TierType
from services.faq_service import faq_service
from services.tutor_profile_service import get_or_create_profile
from services.cache_service import cache_service
from prompts.tutor import build_tutor_prompt

logger = logging.getLogger(__name__)

# ─── Capability mapping ───────────────────────────────────────────────────────
# MEDIUM  → "chat"      capability (standard model, free tier)
# COMPLEX → "reasoning" capability (stronger model, still free tier via Groq)

TIER_CAPABILITY: dict[TierType, str] = {
    "SIMPLE": "chat",      # only used for FAQ wrapper — very short
    "MEDIUM": "chat",
    "COMPLEX": "reasoning",
}


class TutorService:

    # ── Public streaming entry point ─────────────────────────────────────────

    async def achat_stream(
        self,
        db: Session,
        message: str,
        history: list[dict],
        mata_kuliah: Optional[str] = None,
        student_level: str = "intermediate",
    ) -> AsyncIterator[str]:
        """
        Main streaming coroutine for tutor chat.

        Yields:
            Text chunks (str).
            First chunk is special metadata header:
              "\x00TYPE:<type>\x00"   (e.g. "\x00TYPE:SIMPLE\x00")
            All subsequent chunks are regular response text.
        """
        # 1. Classify
        classification = classify(message, history)
        tier: TierType = classification["type"]

        # Yield type header as the very first chunk so the router can read it
        yield f"\x00TYPE:{tier}\x00"

        # Load adaptive profile
        profile = get_or_create_profile(db)

        # 2. Route
        if tier == "SIMPLE":
            async for chunk in self._handle_simple(db, message, mata_kuliah, student_level, profile=profile):
                yield chunk
        elif tier == "MEDIUM":
            async for chunk in self._handle_ai(
                message, history, mata_kuliah, student_level, capability="chat",
                profile=profile,
            ):
                yield chunk
        else:  # COMPLEX
            async for chunk in self._handle_ai(
                message, history, mata_kuliah, student_level, capability="reasoning",
                profile=profile,
            ):
                yield chunk

    # ── SIMPLE: FAQ lookup ────────────────────────────────────────────────────

    async def _handle_simple(
        self,
        db: Session,
        message: str,
        mata_kuliah: Optional[str],
        student_level: str,
        profile=None,
    ) -> AsyncIterator[str]:
        """Look up FAQ and return the answer directly (0 token)."""
        faq = faq_service.find_best_match(db, message, mata_kuliah=mata_kuliah)

        if faq is None:
            logger.debug("No FAQ match for '%s', escalating to MEDIUM.", message[:60])
            async for chunk in self._handle_ai(
                message, [], mata_kuliah, student_level, capability="chat",
                profile=profile,
            ):
                yield chunk
            return

        # Record usage (fire-and-forget, non-blocking)
        import asyncio
        asyncio.create_task(
            asyncio.to_thread(faq_service.record_usage, db, faq.id)
        )

        # Return raw FAQ answer directly — 0 token cost
        yield faq.answer

    # ── MEDIUM / COMPLEX: full AI response ────────────────────────────────────

    async def _handle_ai(
        self,
        message: str,
        history: list[dict],
        mata_kuliah: Optional[str],
        student_level: str,
        capability: str,
        profile=None,
    ) -> AsyncIterator[str]:
        """Stream an AI tutor response using the Socratic prompt."""
        import time

        trimmed_history = _trim_history(history, max_turns=6)
        hist_str = "\n".join(
            f"{m['role']}: {m['content']}" for m in trimmed_history
        )

        prompt_template = build_tutor_prompt(student_level, profile=profile)
        wrapped_input = _wrap_data("pesan_siswa", message)

        sys_content = prompt_template.format(
            mata_kuliah=mata_kuliah or "Umum",
            student_level=student_level,
            history=hist_str,
            input=wrapped_input,
        )

        messages = [SystemMessage(content=sys_content)]
        # Add history as proper message objects (last 10 turns)
        for msg in trimmed_history[-10:]:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            else:
                messages.append(AIMessage(content=msg["content"]))
        messages.append(HumanMessage(content=wrapped_input))

        llm = ai_service._get_llm(capability)

        # Cache lookup — keyed by message + capability + level + subject
        cache_key = f"{message}:{capability}:{student_level}:{mata_kuliah or 'umum'}"
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
            if any(x in err for x in ["timeout", "connection", "502", "503", "504"]):
                yield "\n\n⚠️ Koneksi ke AI terputus. Coba kirim pesan lagi."
            elif "rate limit" in err or "429" in err:
                yield "\n\n⚠️ Limit API tercapai. Tunggu sebentar lalu coba lagi."
            else:
                yield f"\n\n⚠️ Error: {str(exc)}"
            return

        # Normalize math delimiters on complete response (same as ai_service)
        _normalize_math(full_response)

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
