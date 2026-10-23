"""Pure helpers for blueprint normalization and exam question assembly.

Bagian ini sengaja bebas dari akses database agar mudah diuji. Tujuannya:
- memastikan jumlah soal pada blueprint selalu sama dengan total yang diminta;
- menormalkan tipe soal/opsi/jawaban dari AI maupun question bank;
- membuang duplikat dan menempatkan soal objektif lebih dulu.
"""
from __future__ import annotations

import math
import random
import re
from typing import Iterable, Optional

OBJECTIVE_TYPES = {"mcq", "truefalse"}
VALID_TYPES = {
    "mcq",
    "truefalse",
    "essay",
    "short_answer",
    "case_study",
    "calculation",
    "analysis",
}
VALID_DIFFICULTIES = {"mudah", "menengah", "sulit", "campuran"}
VALID_BLOOMS = {"remember", "understand", "apply", "analyze", "evaluate", "create", "mixed"}

_TYPE_ALIASES = {
    "mcq": "mcq",
    "multiple_choice": "mcq",
    "multiple choice": "mcq",
    "pilihan_ganda": "mcq",
    "pilihan ganda": "mcq",
    "truefalse": "truefalse",
    "true_false": "truefalse",
    "true/false": "truefalse",
    "benar_salah": "truefalse",
    "benar/salah": "truefalse",
    "benar salah": "truefalse",
    "essay": "essay",
    "esai": "essay",
    "short_answer": "short_answer",
    "short answer": "short_answer",
    "isian_singkat": "short_answer",
    "isian singkat": "short_answer",
    "case_study": "case_study",
    "case study": "case_study",
    "studi_kasus": "case_study",
    "studi kasus": "case_study",
    "calculation": "calculation",
    "perhitungan": "calculation",
    "analysis": "analysis",
    "analisis": "analysis",
    "mixed": "mixed",
    "campuran": "mixed",
}

_DIFF_ALIASES = {
    "mudah": "mudah",
    "easy": "mudah",
    "pemula": "mudah",
    "menengah": "menengah",
    "medium": "menengah",
    "sedang": "menengah",
    "sulit": "sulit",
    "hard": "sulit",
    "susah": "sulit",
    "campuran": "campuran",
    "mixed": "campuran",
}


def _as_list(value) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    if isinstance(value, str):
        return [part.strip() for part in re.split(r"[,;/]", value) if part.strip()]
    return [value]


def _to_int(value, default: int = 0) -> int:
    try:
        return int(float(str(value).strip()))
    except (TypeError, ValueError):
        return default


def _to_float(value, default: float = 0.0) -> float:
    try:
        return float(str(value).strip().replace("%", ""))
    except (TypeError, ValueError):
        return default


def normalize_type(value, default: str = "mcq") -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[\s\-/]+", "_", text)
    return _TYPE_ALIASES.get(text, _TYPE_ALIASES.get(text.replace("_", " "), default))


def normalize_difficulty(value, default: str = "menengah") -> str:
    text = str(value or "").strip().lower()
    return _DIFF_ALIASES.get(text, default)


def normalize_bloom(value, default: str = "understand") -> str:
    text = str(value or "").strip().lower()
    return text if text in VALID_BLOOMS else default


def _merge_unique(*values) -> list:
    merged = []
    for value in values:
        for item in _as_list(value):
            text = str(item).strip()
            if text and text not in merged:
                merged.append(text)
    return merged


def allocate_counts(total: int, weights: Iterable[float]) -> list[int]:
    """Bagi `total` ke item proporsional terhadap weights (largest remainder)."""
    weights = [max(0.0, float(w or 0)) for w in weights]
    count = len(weights)
    if count == 0:
        return []
    total = max(0, int(total))
    if total == 0:
        return [0] * count
    if total < count:
        # Tidak mungkin memberi 1 soal ke setiap item; prioritaskan bobot terbesar.
        ranked = sorted(range(count), key=lambda i: weights[i], reverse=True)
        result = [0] * count
        for idx in ranked[:total]:
            result[idx] = 1
        return result

    weight_sum = sum(weights)
    if weight_sum <= 0:
        base = total // count
        result = [base] * count
        for i in range(total - (base * count)):
            result[i] += 1
        return result

    raw = [(total * w) / weight_sum for w in weights]
    result = [max(1, math.floor(v)) for v in raw]
    # Jika pembulatan ke bawah + min 1 melebihi total, kurangi dari yang terbesar.
    while sum(result) > total:
        idx = max(range(count), key=lambda i: result[i])
        if result[idx] <= 1:
            break
        result[idx] -= 1
    remainder = total - sum(result)
    # Largest remainder untuk sisa.
    order = sorted(
        range(count),
        key=lambda i: (raw[i] - math.floor(raw[i])),
        reverse=True,
    )
    for i in order[:max(0, remainder)]:
        result[i] += 1
    return result


def normalize_blueprint_items(
    items,
    total_questions: int,
    *,
    default_question_types=None,
    default_difficulty: str = "menengah",
    default_bloom: str = "understand",
) -> list[dict]:
    """Normalisasi item blueprint agar jumlahnya tepat `total_questions`."""
    raw_items = [item for item in _as_list(items) if isinstance(item, dict)]
    default_types = [
        normalize_type(t) for t in _as_list(default_question_types) if normalize_type(t) != "mixed"
    ] or ["mcq"]

    merged: dict[str, dict] = {}
    order: list[str] = []
    for raw in raw_items:
        topic = str(raw.get("topic") or raw.get("name") or "Umum").strip()
        key = topic.casefold()
        if key not in merged:
            merged[key] = {
                "topic": topic,
                "question_count": 0,
                "weight_percent": 0.0,
                "question_types": [],
                "bloom_level": normalize_bloom(raw.get("bloom_level"), default_bloom),
                "difficulty": normalize_difficulty(raw.get("difficulty"), default_difficulty),
                "key_concepts": [],
            }
            order.append(key)
        entry = merged[key]
        entry["question_count"] += max(0, _to_int(raw.get("question_count"), 0))
        entry["weight_percent"] += max(0.0, _to_float(raw.get("weight_percent"), 0.0))
        entry["question_types"] = _merge_unique(
            entry["question_types"], raw.get("question_types"), raw.get("question_type")
        )
        entry["key_concepts"] = _merge_unique(entry["key_concepts"], raw.get("key_concepts"))

    entries = [merged[key] for key in order]
    if not entries:
        entries = [{
            "topic": "Umum",
            "question_count": 0,
            "weight_percent": 0.0,
            "question_types": [],
            "bloom_level": normalize_bloom(default_bloom),
            "difficulty": normalize_difficulty(default_difficulty),
            "key_concepts": [],
        }]

    total = max(1, _to_int(total_questions, 1))
    if len(entries) > total:
        entries = sorted(
            entries,
            key=lambda e: (e["question_count"], e["weight_percent"]),
            reverse=True,
        )[:total]

    weights = [
        e["question_count"] if e["question_count"] > 0 else e["weight_percent"]
        for e in entries
    ]
    counts = allocate_counts(total, weights)

    for entry, count in zip(entries, counts):
        entry["question_count"] = count
        entry["weight_percent"] = round((count / total) * 100, 2)
        types = [normalize_type(t) for t in _as_list(entry["question_types"])]
        types = [t for t in types if t in VALID_TYPES]
        entry["question_types"] = types or list(default_types)
        entry["difficulty"] = normalize_difficulty(entry.get("difficulty"), default_difficulty)
        entry["bloom_level"] = normalize_bloom(entry.get("bloom_level"), default_bloom)
        if not entry["key_concepts"]:
            entry["key_concepts"] = [entry["topic"]]

    return entries


def question_key(question) -> str:
    text = question.get("question", "") if isinstance(question, dict) else str(question or "")
    text = re.sub(r"[^\w\s]", " ", text.lower(), flags=re.UNICODE)
    return " ".join(text.split())


def dedupe_questions(questions: Iterable[dict]) -> list[dict]:
    seen: set[str] = set()
    result: list[dict] = []
    for question in questions:
        if not isinstance(question, dict):
            continue
        key = question_key(question)
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(question)
    return result


def _normalize_options(raw_options, qtype: str) -> tuple[dict, str]:
    """Kembalikan (options_dict, mapping_key_lama_ke_baru)."""
    if isinstance(raw_options, dict):
        pairs = [(str(k).strip(), str(v).strip()) for k, v in raw_options.items() if str(v).strip()]
    elif isinstance(raw_options, (list, tuple)):
        pairs = []
        for idx, value in enumerate(raw_options):
            if isinstance(value, dict):
                key = value.get("key") or value.get("label") or value.get("id")
                text = value.get("text") or value.get("value") or value.get("option")
                if text:
                    pairs.append((str(key or chr(65 + idx)), str(text).strip()))
            else:
                pairs.append((chr(65 + idx), str(value).strip()))
    else:
        pairs = []

    if not pairs and qtype == "truefalse":
        pairs = [("A", "Benar"), ("B", "Salah")]

    options: dict[str, str] = {}
    mapping: dict[str, str] = {}
    for idx, (key, value) in enumerate(pairs):
        new_key = key.upper() if len(key) == 1 and key.isalpha() else chr(65 + idx)
        options[new_key] = value
        mapping[key] = new_key
        mapping[key.upper()] = new_key
        mapping[value.casefold()] = new_key
    return options, mapping


def normalize_question(
    raw,
    *,
    default_type: str = "mcq",
    default_topic: str = "Umum",
    default_difficulty: str = "menengah",
    default_bloom: str = "understand",
) -> Optional[dict]:
    """Validasi + normalisasi satu soal. Return None bila tidak bisa dipakai."""
    if not isinstance(raw, dict):
        return None
    question_text = str(raw.get("question") or raw.get("prompt") or "").strip()
    if len(question_text) < 4:
        return None

    qtype = normalize_type(raw.get("type") or raw.get("question_type"), default_type)
    if qtype == "mixed":
        qtype = normalize_type(default_type, "mcq")
    if qtype not in VALID_TYPES:
        qtype = normalize_type(default_type, "mcq")

    options, option_map = _normalize_options(raw.get("options") or raw.get("choices"), qtype)
    answer = str(raw.get("answer") or raw.get("correct_answer") or "").strip()

    if qtype in OBJECTIVE_TYPES:
        if len(options) < 2:
            return None
        mapped = option_map.get(answer) or option_map.get(answer.upper()) or option_map.get(answer.casefold())
        if not mapped:
            if qtype == "truefalse":
                lowered = answer.casefold()
                if lowered in {"benar", "true", "b", "1"}:
                    mapped = "A"
                elif lowered in {"salah", "false", "s", "0"}:
                    mapped = "B"
            if not mapped and answer.upper() in options:
                mapped = answer.upper()
            if not mapped and answer[:1].upper() in options:
                mapped = answer[:1].upper()
        if not mapped:
            return None
        answer = mapped
        options_list = [f"{key}. {value}" for key, value in options.items()]
    else:
        if not answer:
            return None
        options = {}
        options_list = []

    return {
        "id": raw.get("id"),
        "bank_id": raw.get("bank_id"),
        "topic": str(raw.get("topic") or default_topic).strip() or default_topic,
        "type": qtype,
        "bloom_level": normalize_bloom(raw.get("bloom_level"), default_bloom),
        "difficulty": normalize_difficulty(raw.get("difficulty"), default_difficulty),
        "question": question_text,
        "options": options,
        "options_list": options_list,
        "answer": answer,
        "explanation": str(raw.get("explanation") or "").strip(),
        "material_reference": str(raw.get("material_reference") or raw.get("material_ref") or "").strip(),
        "tips": str(raw.get("tips") or "").strip(),
    }


def order_objective_first(questions: Iterable[dict], rng=None) -> list[dict]:
    """Acak soal lalu letakkan objektif di depan; id diurutkan ulang 1..N."""
    rng = rng or random
    objective = [q for q in questions if q.get("type") in OBJECTIVE_TYPES]
    subjective = [q for q in questions if q.get("type") not in OBJECTIVE_TYPES]
    rng.shuffle(objective)
    rng.shuffle(subjective)
    ordered = objective + subjective
    for index, question in enumerate(ordered, start=1):
        question["id"] = index
    return ordered
