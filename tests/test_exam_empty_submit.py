"""Regresi: sesi ujian yang kehabisan waktu tanpa jawaban tetap bisa dikirim."""

from schemas.exam import SubmitAnswersRequest
from services.assessment_engine import assemble_evaluation


def test_submit_answers_accepts_empty_dict():
    payload = SubmitAnswersRequest(answers={})
    assert payload.answers == {}


def test_assemble_evaluation_scores_empty_answers_as_zero():
    questions = [
        {
            "id": 1,
            "type": "mcq",
            "question": "Ibu kota Indonesia?",
            "options": {"A": "Jakarta", "B": "Bandung"},
            "answer": "A",
            "topic": "Geografi",
        },
        {
            "id": 2,
            "type": "truefalse",
            "question": "Air membeku pada 100°C.",
            "answer": "false",
            "topic": "Fisika",
        },
    ]

    result = assemble_evaluation(questions, {}, "IPA", "simulasi")

    assert result["score"] == 0
    assert result["total_correct"] == 0
    assert result["total_wrong"] == 0
    assert result["total_unanswered"] == 2
