"""Test parse_ai_json: salvage JSON terpotong (max_tokens) + guard respons kosong."""

import pytest

from app.services.json_utils import parse_ai_json


def test_json_utuh_tak_diubah():
    data = parse_ai_json('```json\n{"mcq": [{"question": "Q?", "options": {"A": "a"}}]}\n```')
    assert len(data["mcq"]) == 1
    assert data["mcq"][0]["question"] == "Q?"


def test_salvage_string_unterminated_last_item():
    # Elemen terakhir terpotong di tengah string — elemen pertama masih utuh
    raw = (
        '{"mcq": ['
        '{"question": "Q1?", "options": {"A": "a"}, "answer": "A"},'
        '{"question": "Q2?", "options": {"A": "y'
    )
    data = parse_ai_json(raw)
    assert len(data["mcq"]) == 1
    assert data["mcq"][0]["question"] == "Q1?"


def test_salvage_array_terbuka_kosong():
    data = parse_ai_json('{"items": [{"a": 1},')
    assert data["items"] == [{"a": 1}]


def test_salvage_akhir_koma():
    data = parse_ai_json('{"items": [{},')
    assert data["items"] == [{}]


def test_response_kosong_menyebut_konteks_max_tokens():
    with pytest.raises(ValueError) as exc:
        parse_ai_json("   \n  ", "Quiz AI")
    assert "kosong" in str(exc.value)


def test_latex_begin_tidak_gerus_backslash():
    data = parse_ai_json(
        '{"mcq": [{"question": "Matriks \\\\begin{pmatrix}1&2"}]}'.replace("\\\\", "\\")
    )
    assert data["mcq"][0]["question"] == "Matriks \\begin{pmatrix}1&2"


def test_latex_frac_dan_tan_amatan_dalam_json():
    raw = '{"mcq": [{"question": "Hitung $\\\\frac{1}{2}$ dari $\\\\tan x$"}]}'.replace("\\\\", "\\")
    data = parse_ai_json(raw)
    q = data["mcq"][0]["question"]
    assert "\\frac" in q
    assert "\\tan" in q


def test_salvage_seluruh_objek_terbuka():
    data = parse_ai_json('{"a": [1, 2], "b": {"c":')
    assert data["a"] == [1, 2]
