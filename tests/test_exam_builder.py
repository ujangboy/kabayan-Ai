from services.exam_builder import (
    allocate_counts,
    normalize_blueprint_items,
    normalize_question,
    order_objective_first,
    question_key,
)


def test_normalize_blueprint_exact_total_and_merges_duplicates():
    items = [
        {"topic": "Sel", "question_count": 3, "question_types": ["mcq"]},
        {"topic": "sel", "question_count": 2, "question_types": ["essay"]},
        {"topic": "Jaringan", "question_count": 1, "question_types": ["truefalse"]},
    ]

    result = normalize_blueprint_items(items, 12)

    assert len(result) == 2
    assert sum(item["question_count"] for item in result) == 12
    assert result[0]["topic"] == "Sel"
    assert result[0]["question_count"] == 10
    assert result[1]["question_count"] == 2
    assert round(sum(item["weight_percent"] for item in result), 2) == 100.0


def test_normalize_blueprint_uses_weights_when_counts_missing():
    items = [
        {"topic": "A", "weight_percent": 75},
        {"topic": "B", "weight_percent": 25},
    ]

    result = normalize_blueprint_items(items, 20)

    assert [item["question_count"] for item in result] == [15, 5]


def test_allocate_counts_handles_total_smaller_than_items():
    assert allocate_counts(2, [5, 3, 1]) == [1, 1, 0]


def test_normalize_question_maps_answer_text_to_option_key():
    result = normalize_question({
        "question": "Apa ibu kota Indonesia?",
        "type": "Pilihan Ganda",
        "options": {"1": "Bandung", "2": "Jakarta"},
        "answer": "Jakarta",
    })

    assert result is not None
    assert result["type"] == "mcq"
    assert result["answer"] == "B"
    assert result["options_list"] == ["A. Bandung", "B. Jakarta"]


def test_normalize_true_false_answer_and_rejects_invalid_question():
    result = normalize_question({
        "question": "Air membeku pada 0 derajat Celsius.",
        "type": "Benar / Salah",
        "answer": "Benar",
    })

    assert result is not None
    assert result["type"] == "truefalse"
    assert result["answer"] == "A"
    assert result["options"] == {"A": "Benar", "B": "Salah"}
    assert normalize_question({"question": "", "type": "mcq"}) is None


def test_order_objective_first_reassigns_ids_and_keeps_all_questions():
    questions = [
        {"type": "essay", "question": "Jelaskan sel."},
        {"type": "mcq", "question": "Apa itu sel?"},
        {"type": "truefalse", "question": "Sel adalah unit terkecil."},
    ]

    ordered = order_objective_first(questions)

    assert [q["id"] for q in ordered] == [1, 2, 3]
    assert {q["type"] for q in ordered[:2]} == {"mcq", "truefalse"}
    assert ordered[-1]["type"] == "essay"
    assert ordered[-1]["type"] == "essay"


def test_question_key_ignores_punctuation_and_case():
    assert question_key({"question": "Apa itu SEL?"}) == question_key({"question": "apa itu sel"})
