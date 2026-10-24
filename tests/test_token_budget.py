"""Regresi anggaran token Fase F — output & konteks proporsional per fitur."""
from app import models

import app.services.flashcard_service as flashcard_service_module
import app.services.quiz_service as quiz_service_module
from app.services import token_budget as tb
from app.services.ai_service import CAPABILITY_MAX_TOKENS, _truncate_context
from app.services.flashcard_service import flashcard_service
from app.services.quiz_service import quiz_service
from app.services.usage_service import record_usage


def test_quiz_output_budget_is_conservative():
    # 5 soal PG tidak lagi memakai plafon 4096 token.
    assert tb.quiz_output_tokens(5, 0) == 1500
    assert tb.quiz_output_tokens(5, 0) < 4096
    assert tb.quiz_output_tokens(5, 0) == tb.quiz_output_tokens(5)


def test_quiz_budget_scales_and_caps():
    assert tb.quiz_output_tokens(10, 3) > tb.quiz_output_tokens(5, 0)
    assert tb.quiz_output_tokens(50, 20) == 4096
    assert tb.quiz_output_tokens(1, 0) == 1000


def test_quiz_context_is_proportional():
    assert tb.quiz_context_chars(5, 0) == 5500
    assert tb.quiz_context_chars(1, 0) == 3000
    assert tb.quiz_context_chars(10, 3) == 8000
    assert tb.quiz_context_chars(5, 0) < tb.quiz_context_chars(10, 0)


def test_flashcard_budget_is_conservative():
    assert tb.flashcard_output_tokens(10) == 1150
    assert tb.flashcard_context_chars(10) == 6000
    assert tb.flashcard_output_tokens(1) == 700
    assert tb.flashcard_output_tokens(100) == 3000
    assert tb.flashcard_output_tokens(10) < 4096


def test_exam_question_budget_is_conservative():
    assert tb.exam_question_output_tokens(8) == 2800
    assert tb.exam_question_output_tokens(1) == 1400
    assert tb.exam_question_context_chars(8) == 6500
    assert tb.exam_question_context_chars(1) == 3000
    assert tb.exam_question_output_tokens(8) < 4096


def test_capability_defaults_are_not_blanket_4096():
    assert CAPABILITY_MAX_TOKENS["chat"] == 1200
    assert CAPABILITY_MAX_TOKENS["quiz"] == 2000
    assert CAPABILITY_MAX_TOKENS["flashcard"] == 1200
    assert CAPABILITY_MAX_TOKENS["exam_blueprint"] == 4096


def test_truncate_context_accepts_custom_limit():
    text = "a" * 5000
    out = _truncate_context(text, 1000)
    assert out.startswith("a" * 1000)
    assert "dipotong otomatis" in out
    assert _truncate_context("pendek", 1000) == "pendek"


def test_quiz_service_passes_proportional_budgets(db_session, make_subject, monkeypatch):
    subject = make_subject("Biologi")
    captured = {}

    def fake_generate(**kwargs):
        captured.update(kwargs)
        return (
            '{"mcq": [{"question": "Q", "options": {"A": "satu", "B": "dua", '
            '"C": "tiga", "D": "empat"}, "answer": "A", "explanation": "ok"}], '
            '"essay": []}'
        )

    monkeypatch.setattr(quiz_service_module.ai_service, "generate", fake_generate)

    quiz_service.generate_quiz(
        db_session, subject.id, context="materi " * 2000,
        mcq_count=5, essay_count=0, title="Quiz Uji",
    )

    assert captured["max_tokens"] == 1500
    assert captured["max_context_chars"] == 5500


def test_flashcard_service_passes_proportional_budgets(db_session, make_subject, monkeypatch):
    subject = make_subject("Fisika")
    captured = {}

    def fake_generate(**kwargs):
        captured.update(kwargs)
        return '[{"question": "Apa itu gaya?", "answer": "Gaya adalah dorongan."}]'

    monkeypatch.setattr(flashcard_service_module.ai_service, "generate", fake_generate)

    flashcard_service.generate_flashcards(
        db_session, subject.id, context="materi " * 2000, count=2, title="Deck Uji",
    )

    assert captured["max_tokens"] == 700
    assert captured["max_context_chars"] == 2800


def test_record_usage_counts_prompt_and_response(db_session):
    record_usage(db_session, "quiz", "a" * 400, "b" * 800)
    log = db_session.query(models.UsageLog).filter(models.UsageLog.feature == "quiz").one()
    assert log.tokens == 300  # (400 + 800) // 4
