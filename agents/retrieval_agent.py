"""
Retrieval Agent — Agentic RAG (CRAG-style) untuk Kabayan AI.

Siklus self-correction tanpa LangGraph (drop-in untuk migrasi nanti):
  1. RETRIEVE   — rag_service.search(query, doc_ids, top_k)
  2. EVALUATE   — skor kualitas retrieval (0-token, heuristik deterministik)
  3. CORRECT    — jika kurang: reformulasi query + retry (maks 2x)
  4. BROADEN    — jika masih kurang: ambil lebih banyak chunk dari doc yang sama
  5. FALLBACK   — jika tetap kosong: tandai needs_clarification=True agar
                 pemanggil meminta klarifikasi ke user (bukan halusinasi)

Seluruh evaluasi memakai heuristik lokal (0 token LLM) sesuai pola
tutor_classifier — hanya memanggil LLM saat benar-benar menjawab.
"""

from __future__ import annotations

import logging
import re
import asyncio
from dataclasses import dataclass, field
from typing import List, Optional

from services.rag_service import rag_service

logger = logging.getLogger(__name__)

# ─── Konstanta evaluasi ──────────────────────────────────────────────────────
TOP_K_INITIAL = 5
TOP_K_RETRY = 12
MAX_RETRIES = 2                       # jumlah reformulasi query (selain query asli)
MIN_CONTEXT_WORDS = 40                # kurang dari ini = tidak cukup jawab
SUFFICIENT_SCORE = 0.55               # skor evaluasi untuk status "sufficient"
PARTIAL_SCORE = 0.25                  # skor evaluasi untuk status "partial"
MAX_CONTEXT_WORDS = 800               # batas konteks yang dikirim ke LLM
MAX_REFORMULATION_WORDS = 8           # panjang query reformulasi (kata kunci inti)

# Kata tanya / penghubung yang dibuang saat reformulasi query
_QUERY_NOISE = {
    # Indonesia
    "apa", "apakah", "siapa", "kenapa", "mengapa", "bagaimana", "kapan",
    "dimana", "yang", "di", "ke", "dari", "dengan", "pada", "untuk", "agar",
    "tolong", "jelaskan", "coba", "beri", "contoh", "kapan", "dan", "atau",
    "itu", "ini", "ada", "adalah", "mengapa", "kenapa", "jelasin",
    # English
    "what", "why", "how", "when", "where", "who", "which", "explain",
    "please", "tell", "give", "example", "the", "a", "an", "of", "to",
    "in", "on", "for", "and", "or", "is", "are", "be",
}

# Kata tanya yang boleh tetap dipertahankan (penting untuk konteks)
_KEEP_IF_PRESENT = {"hukum", "teorema", "rumus", "definisi", "prinsip", "metode"}


@dataclass
class RetrievalResult:
    """Hasil lengkap satu siklus retrieval agent."""
    status: str                          # no_docs / sufficient / partial / insufficient / empty
    context: str = ""                    # konteks final (siap dikirim ke LLM)
    sources: List[dict] = field(default_factory=list)
    attempts: int = 0                    # jumlah kali search dieksekusi
    reformulations: List[str] = field(default_factory=list)
    needs_clarification: bool = False    # True = minta user mengklarifikasi
    reason: str = ""


class RetrievalAgent:
    """CRAG-style agent: retrieve → evaluate → correct → broaden → fallback."""

    # ── Entry point ────────────────────────────────────────────────────────

    def run(
        self,
        query: str,
        doc_ids: Optional[List[str]] = None,
        max_context_words: int = MAX_CONTEXT_WORDS,
    ) -> RetrievalResult:
        if not query or not query.strip():
            return RetrievalResult(
                status="empty", reason="Query kosong — tidak ada retrieval dilakukan."
            )
        doc_ids = [d for d in (doc_ids or []) if d]
        if not doc_ids:
            return RetrievalResult(
                status="no_docs",
                reason="Tidak ada dokumen aktif untuk pencarian (doc_ids kosong).",
            )

        query = query.strip()
        reformulations: List[str] = []
        attempts = 0
        best: Optional[dict] = None

        # ── Siklus 1: query asli ────────────────────────────────────────────
        current_query = query
        for attempt in range(MAX_RETRIES + 1):
            top_k = TOP_K_INITIAL if attempt == 0 else TOP_K_RETRY
            try:
                result = rag_service.search(current_query, doc_ids, top_k=top_k)
            except Exception as exc:
                logger.warning("Retrieval search gagal (attempt %d): %s", attempt, exc)
                break
            attempts += 1

            text = result.get("text", "") or ""
            sources = result.get("sources", []) or []
            score = self._evaluate(query, text)

            if best is None or score > best["score"]:
                best = {"text": text, "sources": sources, "score": score, "query": current_query}

            # Cukup → langsung selesai
            if score >= SUFFICIENT_SCORE and self._word_count(text) >= MIN_CONTEXT_WORDS:
                return self._build(query, current_query, best, attempts, reformulations,
                                   status="sufficient")

            # Kurang → reformulasi query untuk retry
            if attempt < MAX_RETRIES:
                reformed = self._reformulate(current_query)
                if not reformed or reformed == current_query or reformed in reformulations:
                    break
                reformulations.append(reformed)
                current_query = reformed

        # ── Siklus 2: broaden — ambil lebih banyak chunk dari doc yang sama ──
        if best is None or self._word_count(best["text"]) < MIN_CONTEXT_WORDS:
            try:
                from services.rag_context_service import rag_context_service
                broad = rag_context_service._gather_chunks(doc_ids, max_context_words)
                broad = (broad or "").strip()
            except Exception as exc:
                logger.warning("Broaden gather gagal: %s", exc)
                broad = ""
            if broad:
                broad_score = self._evaluate(query, broad)
                if best is None or broad_score > best["score"]:
                    best = {"text": broad, "sources": [], "score": broad_score, "query": current_query}

        if best is None or not best["text"].strip():
            return RetrievalResult(
                status="empty",
                attempts=attempts,
                reformulations=reformulations,
                needs_clarification=True,
                reason="Retrieval gagal total — tidak ada chunk yang ditemukan. "
                       "Minta klarifikasi atau arahkan user ke materi yang relevan.",
            )

        # ── Klasifikasi final ───────────────────────────────────────────────
        word_count = self._word_count(best["text"])
        if best["score"] >= SUFFICIENT_SCORE and word_count >= MIN_CONTEXT_WORDS:
            return self._build(query, current_query, best, attempts, reformulations,
                               status="sufficient")
        if best["score"] >= PARTIAL_SCORE and word_count > 0:
            return self._build(query, current_query, best, attempts, reformulations,
                               status="partial",
                               needs_clarification=word_count < MIN_CONTEXT_WORDS)
        return self._build(query, current_query, best, attempts, reformulations,
                           status="insufficient", needs_clarification=True)

    async def arun(
        self,
        query: str,
        doc_ids: Optional[List[str]] = None,
        max_context_words: int = MAX_CONTEXT_WORDS,
    ) -> RetrievalResult:
        """Versi async — jalankan di thread agar tidak memblokir event loop."""
        return await asyncio.to_thread(self.run, query, doc_ids, max_context_words)

    # ── Evaluasi (0 token) ─────────────────────────────────────────────────

    def _keywords(self, query: str) -> List[str]:
        """Ekstrak kata kunci penting dari query (buang kata tanya/noise)."""
        norm = query.lower()
        norm = re.sub(r"[^a-z0-9\s]", " ", norm)
        tokens = [t for t in norm.split() if t not in _QUERY_NOISE]
        # Prioritas: istilah majemuk dipertahankan utuh jika ada kata inti
        return tokens[:MAX_REFORMULATION_WORDS]

    def _evaluate(self, query: str, text: str) -> float:
        """Skor kualitas retrieval 0.0–1.0 (heuristik, tanpa LLM).

        Komponen:
          - Keyword hit rate: berapa banyak kata kunci query muncul di hasil.
          - Coverage: panjang hasil relatif terhadap kebutuhan MIN_CONTEXT_WORDS.
        """
        if not text:
            return 0.0
        keywords = self._keywords(query)
        lowered = text.lower()
        if keywords:
            hits = sum(1 for k in keywords if k in lowered)
            kw_score = hits / len(keywords)
        else:
            kw_score = 0.5  # query tanpa kata kunci → netral, andalkan coverage
        coverage = min(1.0, self._word_count(text) / MIN_CONTEXT_WORDS)
        return round(0.6 * kw_score + 0.4 * coverage, 3)

    def _reformulate(self, query: str) -> str:
        """Bangun query alternatif: hanya kata kunci inti (tanpa kata tanya).

        Contoh: "apa perbedaan hukum newton pertama dan kedua?"
          → "hukum newton pertama kedua"
        """
        keywords = self._keywords(query)
        if not keywords:
            return ""
        return " ".join(keywords[:MAX_REFORMULATION_WORDS])

    # ── Helpers ─────────────────────────────────────────────────────────────

    @staticmethod
    def _word_count(text: str) -> int:
        return len(text.split())

    @staticmethod
    def _truncate_words(text: str, max_words: int) -> str:
        words = text.split()
        if len(words) <= max_words:
            return text
        return " ".join(words[:max_words])

    def _build(
        self,
        original_query: str,
        used_query: str,
        best: dict,
        attempts: int,
        reformulations: List[str],
        status: str,
        needs_clarification: bool = False,
    ) -> RetrievalResult:
        context = self._truncate_words(best["text"], MAX_CONTEXT_WORDS)
        reason = (
            f"status={status}, skor={best['score']:.2f}, "
            f"kata={self._word_count(context)}, source={len(best['sources'])}, "
            f"attempts={attempts}"
        )
        return RetrievalResult(
            status=status,
            context=context,
            sources=best.get("sources", []),
            attempts=attempts,
            reformulations=reformulations,
            needs_clarification=needs_clarification,
            reason=reason,
        )


retrieval_agent = RetrievalAgent()
