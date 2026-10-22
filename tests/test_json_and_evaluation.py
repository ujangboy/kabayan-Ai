from services.assessment_engine import assemble_evaluation
from services.json_utils import parse_ai_json


def test_parse_ai_json_keeps_outer_object_with_nested_array():
    raw = '```json\n{"title": "Blueprint", "blueprint_items": [{"topic": "Sel"}], "note": "brace } dan [ aman"}\n```'
    data = parse_ai_json(raw)
    assert isinstance(data, dict)
    assert data["title"] == "Blueprint"
    assert data["blueprint_items"][0]["topic"] == "Sel"


def test_parse_ai_json_accepts_outer_array():
    data = parse_ai_json('[{"questions": [{"id": 1}]}]')
    assert isinstance(data, list)
    assert data[0]["questions"][0]["id"] == 1


def test_parse_ai_json_accepts_literal_newlines_in_strings():
    raw = '{"questions": [{"question": "baris pertama\nbaris kedua"}]}'
    data = parse_ai_json(raw)
    assert "baris pertama" in data["questions"][0]["question"]


def test_assemble_evaluation_marks_exact_subjective_fallback_correct():
    questions = [
        {
            "id": 1,
            "type": "short_answer",
            "topic": "Sel",
            "question": "Apa fungsi mitokondria?",
            "answer": "Mitokondria menghasilkan ATP melalui respirasi sel.",
        }
    ]
    answers = {"1": "Mitokondria menghasilkan ATP melalui respirasi sel."}

    result = assemble_evaluation(questions, answers, "Biologi", "uts", {})

    assert result["score"] == 100
    assert result["total_correct"] == 1
    assert result["per_question_feedback"][0]["is_correct"] is True


def test_assemble_evaluation_does_not_invent_correctness_for_wrong_subjective():
    questions = [
        {
            "id": 1,
            "type": "short_answer",
            "topic": "Sel",
            "question": "Apa fungsi mitokondria?",
            "answer": "Mitokondria menghasilkan ATP melalui respirasi sel.",
        }
    ]
    answers = {"1": "Nukleus menyimpan DNA."}

    result = assemble_evaluation(questions, answers, "Biologi", "uts", {})

    assert result["score"] == 0
    assert result["per_question_feedback"][0]["is_correct"] is False
