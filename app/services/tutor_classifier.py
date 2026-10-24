"""
Smart Classifier untuk AI Tutor Kabayan AI.

Mengklasifikasikan pesan siswa ke tiga tier tanpa token cost:
  SIMPLE  (~70%) — definisi, rumus dasar, FAQ → jawab dari database
  MEDIUM  (~20%) — penjelasan, contoh soal, langkah-langkah → Groq (model standar)
  COMPLEX (~10%) — pembuktian, "kenapa", analisis mendalam → Groq (model lebih kuat)

Algoritma:
  1. Normalisasi + tokenisasi pesan
  2. Keyword scoring berbobot per tier
  3. Length penalty (pesan sangat pendek → cenderung SIMPLE/follow-up)
  4. Context inheritance: follow-up pendek mewarisi tier pesan sebelumnya
  5. Threshold → output final
"""

from __future__ import annotations

import re
from typing import Literal, TypedDict

# ─── Type definitions ────────────────────────────────────────────────────────

TierType = Literal["SIMPLE", "MEDIUM", "COMPLEX"]


class ClassificationResult(TypedDict):
    type: TierType
    confidence: int          # 0–100
    reason: str
    suggested_handler: Literal["faq", "groq_standard", "groq_complex"]


# ─── Keyword tables ──────────────────────────────────────────────────────────
# Format: keyword → score contribution (positive = pushes toward that tier)
# COMPLEX keywords trump all; MEDIUM override SIMPLE.

COMPLEX_KEYWORDS: dict[str, int] = {
    # Reasoning / proof indicators
    "kenapa": 4,
    "mengapa": 4,
    "buktikan": 5,
    "bukti": 4,
    "pembuktian": 5,
    "derivasi": 5,
    "turunkan": 4,
    "deduksi": 5,
    "induktif": 4,
    "deduktif": 4,
    "analisis": 2,
    "analisa": 2,
    "evaluasi": 3,
    "bandingkan": 4,
    "analisis hubungan": 4,  # "analisis hubungan antara X dan Y" → COMPLEX
    "analisis perbedaan": 4,
    "analisis dampak": 4,
    "analisis struktur": 4,
    "analisis mendalam": 4,
    "perbedaan antara": 4,
    "hubungan antara": 4,
    "jelaskan mengapa": 5,
    "bagaimana bisa": 3,
    "apa hubungan": 4,
    "apa kaitan": 4,
    "mekanisme": 3,
    "teorema": 4,
    "lemma": 4,
    "korolari": 4,
    "implikasi": 3,
    "konsekuensi": 3,
    "optimasi": 5,
    "optimisasi": 5,
    "kompleksitas": 3,
    "l'hopital": 5,
    "l'hôpital": 5,
    "lhopital": 5,
    "epsilon delta": 5,
    "induksi matematika": 5,
    "kontraposisi": 4,
    "kontradiksi": 4,
    "paradoks": 4,
}

MEDIUM_KEYWORDS: dict[str, int] = {
    # Step-by-step / explanation
    "jelaskan": 2,
    "cara": 2,
    "bagaimana": 2,
    "langkah": 2,
    "langkah langkah": 3,  # normalized form of "langkah-langkah"
    "proses": 2,
    "metode": 2,
    "selesaikan": 3,
    "hitung": 2,
    "hitunglah": 2,
    "tentukan": 3,
    "cari nilai": 2,
    "carilah": 2,
    "selesaikan soal": 3,
    "berikan contoh": 2,
    "contoh soal": 2,
    "penerapan": 2,
    "aplikasi": 2,
    "gunakan": 2,
    "terapkan": 3,
    "kerjakan": 2,
    "soal": 2,
    "permasalahan": 2,
    "masalah": 1,
    "turunan dari": 2,
    "integral dari": 2,
    "limit dari": 2,
    "nilai dari": 1,
    "gambarkan": 2,
    "grafik": 2,
    "skema": 2,
    "diagram": 2,
}

SIMPLE_KEYWORDS: dict[str, int] = {
    # Definition / formula lookup
    "apa itu": 2,
    "apa yang dimaksud": 2,
    "definisi": 2,
    "pengertian": 2,
    "rumus": 2,
    "formula": 2,
    "singkatan": 2,
    "kepanjangan": 2,
    "satuan": 2,
    "simbol": 2,
    "notasi": 2,
    "kapan": 1,
    "siapa": 1,
    "dimana": 1,
    "di mana": 1,
    "berapa": 1,
}

# ─── Follow-up markers (very short, context-dependent) ──────────────────────
# NOTE: "kenapa" / "mengapa" are intentionally excluded — they are strong COMPLEX
# keywords that must go through the scoring path even when short.
FOLLOWUP_MARKERS: set[str] = {
    "terus", "lanjut", "lanjutkan", "selanjutnya", "next",
    "oke", "ok", "paham", "ngerti", "mengerti", "ya", "iya",
    "terus gimana", "lalu", "setelah itu",
    "reveal", "kasih jawaban", "jawaban lengkap", "jawaban penuh",
    "?",
}

# ─── Thresholds ──────────────────────────────────────────────────────────────
COMPLEX_THRESHOLD = 3    # complex score ≥ this → COMPLEX
MEDIUM_THRESHOLD = 2     # medium score ≥ this → MEDIUM (if not COMPLEX)

# Short follow-up: if message is ≤ this many words AND matches a follow-up marker
FOLLOWUP_MAX_WORDS = 5


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    """Lowercase, strip punctuation (keep apostrophes for l'hopital etc.), collapse whitespace."""
    text = text.lower().strip()
    # Replace apostrophe in common contractions/names first (l'hopital → lhopital)
    text = re.sub(r"(\w)'(\w)", r"\1\2", text)
    # Then strip remaining punctuation
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text)


def _score_keywords(text: str, keywords: dict[str, int]) -> int:
    """Sum scores for all keyword hits in text (multi-word keywords supported)."""
    score = 0
    for kw, weight in keywords.items():
        if kw in text:
            score += weight
    return score


def _is_followup(text_norm: str, word_count: int) -> bool:
    """Return True if the message looks like a short follow-up."""
    if word_count > FOLLOWUP_MAX_WORDS:
        return False
    # Check if any follow-up marker appears in the normalized text
    for marker in FOLLOWUP_MARKERS:
        if marker in text_norm:
            return True
    # Bare single-word messages are almost always follow-ups
    if word_count <= 2:
        return True
    return False


# ─── Main classifier ─────────────────────────────────────────────────────────

def classify(
    message: str,
    history: list[dict] | None = None,
) -> ClassificationResult:
    """
    Classify a student message into SIMPLE / MEDIUM / COMPLEX.

    Args:
        message:  The student's current message.
        history:  List of previous messages as {"role": str, "content": str}.
                  Used for context inheritance on follow-up messages.

    Returns:
        ClassificationResult TypedDict.
    """
    if not message or not message.strip():
        return ClassificationResult(
            type="SIMPLE",
            confidence=90,
            reason="Pesan kosong atau whitespace — default ke SIMPLE.",
            suggested_handler="faq",
        )

    norm = _normalize(message)
    words = norm.split()
    word_count = len(words)

    # ── 1. Check follow-up context inheritance ───────────────────────────────
    if _is_followup(norm, word_count) and history:
        # Find last AI message and the classification type stored in the last user message
        # We look at the last user-side message before this one for context
        prev_types: list[TierType] = []
        for msg in reversed(history):
            if msg.get("role") == "ai" or msg.get("role") == "assistant":
                # Inherit the previous AI response's complexity
                # We don't store type in history, so we re-derive from content length
                content = msg.get("content", "")
                if len(content) > 800:
                    prev_types.append("COMPLEX")
                elif len(content) > 300:
                    prev_types.append("MEDIUM")
                else:
                    prev_types.append("SIMPLE")
                break

        if prev_types:
            inherited = prev_types[0]
            # "reveal" / "jawaban" → always route to AI so it can give full solution
            if any(m in norm for m in ("reveal", "kasih jawaban", "jawaban lengkap", "jawaban penuh")):
                return ClassificationResult(
                    type="MEDIUM",
                    confidence=85,
                    reason="Siswa minta jawaban penuh (reveal) — route ke Groq untuk penjelasan lengkap.",
                    suggested_handler="groq_standard",
                )
            return ClassificationResult(
                type=inherited,
                confidence=75,
                reason=f"Follow-up pendek — mewarisi tier sebelumnya ({inherited}).",
                suggested_handler=_handler(inherited),
            )

    # ── 2. Keyword scoring ───────────────────────────────────────────────────
    complex_score = _score_keywords(norm, COMPLEX_KEYWORDS)
    medium_score = _score_keywords(norm, MEDIUM_KEYWORDS)
    simple_score = _score_keywords(norm, SIMPLE_KEYWORDS)

    # ── 3. Length heuristic ──────────────────────────────────────────────────
    # Long messages (>25 words) likely need explanation → boost medium
    if word_count > 25:
        medium_score += 2
    # Very short messages with no strong keywords lean simple
    if word_count <= 4 and complex_score == 0 and medium_score == 0:
        simple_score += 3

    # ── 4. Tier decision ─────────────────────────────────────────────────────
    if complex_score >= COMPLEX_THRESHOLD:
        confidence = min(95, 60 + complex_score * 5)
        return ClassificationResult(
            type="COMPLEX",
            confidence=confidence,
            reason=f"Skor COMPLEX={complex_score} (threshold={COMPLEX_THRESHOLD}). Pertanyaan mendalam/pembuktian.",
            suggested_handler="groq_complex",
        )

    if medium_score >= MEDIUM_THRESHOLD:
        confidence = min(90, 55 + medium_score * 5)
        return ClassificationResult(
            type="MEDIUM",
            confidence=confidence,
            reason=f"Skor MEDIUM={medium_score} (threshold={MEDIUM_THRESHOLD}). Pertanyaan penjelasan/langkah.",
            suggested_handler="groq_standard",
        )

    # Default SIMPLE
    confidence = min(90, 50 + simple_score * 5 + (10 if word_count <= 8 else 0))
    return ClassificationResult(
        type="SIMPLE",
        confidence=confidence,
        reason=f"Skor SIMPLE={simple_score}, MEDIUM={medium_score}, COMPLEX={complex_score}. Pertanyaan definisi/rumus.",
        suggested_handler="faq",
    )


def _handler(tier: TierType) -> Literal["faq", "groq_standard", "groq_complex"]:
    return {"SIMPLE": "faq", "MEDIUM": "groq_standard", "COMPLEX": "groq_complex"}[tier]
