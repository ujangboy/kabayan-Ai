"""Anggaran token per kapabilitas AI.

Tujuan: jangan lagi memakai plafon 4096 token untuk semua output. Setiap
kapabilitas punya kebutuhan output yang berbeda, dan konteks yang dikirim
harus proporsional dengan jumlah item yang diminta.

Angka di sini adalah estimasi konservatif (bahasa Indonesia + JSON), bukan
batas keras model. Nilai output dibulatkan ke atas agar JSON tetap utuh.
"""

MAX_CONTEXT_CHARS = 8000
MAX_OUTPUT_TOKENS = 4096


def _as_count(value, default: int = 0) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return default


def quiz_output_tokens(mcq_count, essay_count=0) -> int:
    """Plafon output kuis: 5 PG ≈ 1500 token (bukan 4096)."""
    mcq = _as_count(mcq_count)
    essay = _as_count(essay_count)
    estimated = 500 + (mcq * 200) + (essay * 250)
    return min(MAX_OUTPUT_TOKENS, max(1000, estimated))


def quiz_context_chars(mcq_count, essay_count=0) -> int:
    """Konteks kuis proporsional: 5 PG ≈ 5500 karakter."""
    mcq = _as_count(mcq_count)
    essay = _as_count(essay_count)
    return min(MAX_CONTEXT_CHARS, max(3000, 2000 + (mcq * 700) + (essay * 800)))


def flashcard_output_tokens(count=10) -> int:
    """Plafon output flashcard: 10 kartu ≈ 1150 token."""
    n = _as_count(count, default=10)
    return min(3000, max(700, 250 + (n * 90)))


def flashcard_context_chars(count=10) -> int:
    """Konteks flashcard proporsional: 10 kartu ≈ 6000 karakter."""
    n = _as_count(count, default=10)
    return min(MAX_CONTEXT_CHARS, max(2500, 2000 + (n * 400)))


def exam_question_output_tokens(count=1) -> int:
    """Plafon output generator soal ujian: 8 soal ≈ 2800 token."""
    n = _as_count(count, default=1)
    return min(MAX_OUTPUT_TOKENS, max(1400, 400 + (n * 300)))


def exam_question_context_chars(count=1) -> int:
    """Konteks generator soal ujian proporsional dengan jumlah soal."""
    n = _as_count(count, default=1)
    return min(MAX_CONTEXT_CHARS, max(3000, 2500 + (n * 500)))
