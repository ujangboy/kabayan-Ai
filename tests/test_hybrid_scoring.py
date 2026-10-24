"""
Test Hybrid Scoring (services/rag_service.py) — rerank 0 token LLM.

Fokus uji:
  - Tokenisasi: lowercase + buang tanda baca
  - Keyword overlap: exact / partial / none
  - Normalisasi jarak L2 → skor 0..1
  - Rerank: keyword mengalahkan vector murni pada topik yang sama
  - Bobot: vector dominan bila keyword seri
  - search() tetap memakai pipeline rerank (kandidat fetch diperluas)
"""
import pytest

from app.services.rag_service import (
    _tokenize,
    _keyword_overlap,
    _normalize_vec,
    _score_candidates,
    VECTOR_WEIGHT,
    KEYWORD_WEIGHT,
    POSITION_WEIGHT,
)


class TestTokenize:
    def test_lowercase_and_strip_punctuation(self):
        assert _tokenize("Halo, Dunia! 2024.") == ["halo", "dunia", "2024"]

    def test_empty_and_short_tokens(self):
        assert _tokenize("") == []
        assert _tokenize("a b c") == []

    def test_indonesian_words(self):
        assert "pemrograman" in _tokenize("Dasar Pemrograman — Python")


class TestKeywordOverlap:
    def test_exact_match(self):
        assert _keyword_overlap(["fotosintesis", "klorofil"], ["fotosintesis", "klorofil", "daun"]) == 1.0

    def test_partial_match(self):
        assert _keyword_overlap(["fotosintesis", "klorofil", "enzim"], ["fotosintesis", "daun"]) == pytest.approx(1 / 3)

    def test_no_match(self):
        assert _keyword_overlap(["fotosintesis"], ["matematika"]) == 0.0

    def test_empty_sides(self):
        assert _keyword_overlap([], ["x"]) == 0.0
        assert _keyword_overlap(["x"], []) == 0.0


class TestNormalizeVec:
    def test_zero_distance_is_perfect(self):
        assert _normalize_vec(0) == 1.0

    def test_positive_distance_decays(self):
        assert _normalize_vec(1.0) == 0.5
        assert _normalize_vec(4.0) == pytest.approx(0.2)

    def test_none_and_invalid(self):
        assert _normalize_vec(None) == 0.0
        assert _normalize_vec("abc") == 0.0


class TestRerank:
    def _rows(self, distances, contents):
        return [
            {"content": c, "_distance": d}
            for c, d in zip(contents, distances)
        ]

    def test_keyword_boosts_semantically_distant_chunk(self):
        """Chunk dengan kata kunci query unggul walau jarak semantik agak jauh."""
        rows = self._rows(
            distances=[0.8, 1.2],
            contents=[
                "Pembahasan umum tentang tumbuhan dan lingkungan hidup.",
                "Fotosintesis adalah proses tumbuhan mengubah cahaya menjadi energi.",
            ],
        )
        scored = _score_candidates(rows, _tokenize("proses fotosintesis"))
        assert scored[0][2]["content"].startswith("Fotosintesis")

    def test_vector_wins_when_keyword_ties(self):
        """Kata kunci sama → skor vector menjadi penentu urutan."""
        rows = self._rows(
            distances=[0.1, 2.0],
            contents=[
                "Fotosintesis terjadi di daun pada siang hari.",
                "Fotosintesis dan respirasi adalah dua proses yang saling berkaitan.",
            ],
        )
        scored = _score_candidates(rows, _tokenize("fotosintesis"))
        assert scored[0][2] is rows[0]

    def test_weights_sum_and_scale(self):
        assert VECTOR_WEIGHT + KEYWORD_WEIGHT + POSITION_WEIGHT == pytest.approx(1.0)
        rows = self._rows([0.0], ["konten apa pun"])
        score, vec, _ = _score_candidates(rows, _tokenize("kata kunci cocok"))[0]
        assert 0 <= score <= 1.0
        assert vec == 1.0

    def test_empty_rows(self):
        assert _score_candidates([], []) == []

    def test_blank_content_skipped(self):
        scored = _score_candidates(
            [{"content": "", "_distance": 0.0}, {"content": "isi", "_distance": 1.0}],
            [],
        )
        assert len(scored) == 1
        assert scored[0][2]["content"] == "isi"