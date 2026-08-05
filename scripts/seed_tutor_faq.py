"""
Seed script: generate ~20 FAQ entries per mata pelajaran via Groq.

Usage (from project root):
    python scripts/seed_tutor_faq.py

Behavior:
  - Idempotent: skips a mata_kuliah if >= 10 entries already exist.
  - Calls Groq once per mapel with plain text + JSON parsing (no output_schema).
  - Saves all entries to tutor_faq table.
  - Also seeds a small set of TutorTemplate formula entries.
  - Adds delay between requests to respect Groq free-tier rate limits.

Mata pelajaran seeded:
  Matematika, Fisika, Biologi, Kimia, Bahasa Indonesia, Bahasa Inggris
"""

import sys
import os
import json
import datetime
import logging
import time
import re

# Ensure project root is on sys.path when run from scripts/ or project root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

from langchain_core.prompts import PromptTemplate
from database import SessionLocal
from services.ai_service import ai_service
import models


# ─── Prompt template ─────────────────────────────────────────────────────────

FAQ_GEN_PROMPT = PromptTemplate(
    input_variables=["mata_kuliah", "topics"],
    template="""Kamu adalah guru berpengalaman kurikulum SMP-SMA Indonesia.

Buat 20 FAQ (frequently asked questions) untuk mata pelajaran **{mata_kuliah}**.

Topik yang harus dicakup (pilih variasi):
{topics}

PENTING: Kembalikan HANYA JSON valid, tanpa teks lain sebelum atau sesudah JSON. Format:
{{
  "faqs": [
    {{
      "topic": "nama sub-topik",
      "keywords": ["kata1", "kata2", "kata3"],
      "question": "pertanyaan dari siswa",
      "answer": "jawaban singkat max 120 kata",
      "difficulty": "mudah"
    }}
  ]
}}

Aturan:
- difficulty hanya: mudah / sedang / sulit
- keywords: 3-5 kata kunci yang mungkin dipakai siswa
- question: natural, seperti yang ditanyakan siswa
- answer: jelas, padat, bahasa Indonesia
- Tepat 20 entries""",
)


# ─── Template seed data ───────────────────────────────────────────────────────

FORMULA_TEMPLATES = [
    {
        "mata_kuliah": "Matematika",
        "type": "formula",
        "title": "Rumus Turunan Fungsi Pangkat",
        "content": "Jika f(x) = x^n, maka f'(x) = n*x^(n-1)\n\nContoh: f(x) = x^3 -> f'(x) = 3x^2",
        "variables_json": json.dumps([{"name": "n", "description": "eksponen/pangkat", "type": "number"}]),
    },
    {
        "mata_kuliah": "Matematika",
        "type": "formula",
        "title": "Rumus Integral Fungsi Pangkat",
        "content": "Integral x^n dx = x^(n+1)/(n+1) + C  (untuk n != -1)\n\nContoh: integral x^2 dx = x^3/3 + C",
        "variables_json": json.dumps([
            {"name": "n", "description": "eksponen", "type": "number"},
            {"name": "C", "description": "konstanta integrasi", "type": "constant"},
        ]),
    },
    {
        "mata_kuliah": "Fisika",
        "type": "formula",
        "title": "Hukum Newton Kedua",
        "content": "F = m x a\n\nKeterangan:\n- F = gaya (Newton, N)\n- m = massa (kg)\n- a = percepatan (m/s^2)",
        "variables_json": json.dumps([
            {"name": "F", "description": "Gaya (Newton)", "type": "number"},
            {"name": "m", "description": "Massa (kg)", "type": "number"},
            {"name": "a", "description": "Percepatan (m/s^2)", "type": "number"},
        ]),
    },
    {
        "mata_kuliah": "Fisika",
        "type": "formula",
        "title": "Energi Kinetik",
        "content": "Ek = 1/2 x m x v^2\n\nKeterangan:\n- Ek = energi kinetik (Joule)\n- m = massa (kg)\n- v = kecepatan (m/s)",
        "variables_json": json.dumps([
            {"name": "Ek", "description": "Energi kinetik (J)", "type": "number"},
            {"name": "m", "description": "Massa (kg)", "type": "number"},
            {"name": "v", "description": "Kecepatan (m/s)", "type": "number"},
        ]),
    },
    {
        "mata_kuliah": "Kimia",
        "type": "formula",
        "title": "Rumus Mol",
        "content": "n = m / Mr\n\nKeterangan:\n- n = jumlah mol\n- m = massa zat (gram)\n- Mr = massa relatif molekul (g/mol)",
        "variables_json": json.dumps([
            {"name": "n", "description": "Jumlah mol", "type": "number"},
            {"name": "m", "description": "Massa (gram)", "type": "number"},
            {"name": "Mr", "description": "Massa relatif molekul", "type": "number"},
        ]),
    },
]


# ─── Mata pelajaran config ────────────────────────────────────────────────────

MAPEL_CONFIG = {
    "Matematika": "Limit fungsi, Turunan, Integral, Aljabar (SPLDV, persamaan kuadrat), Trigonometri, Geometri, Statistika, Peluang",
    "Fisika": "Kinematika, Dinamika (hukum Newton), Energi & Usaha, Gelombang, Optika, Listrik & Magnet",
    "Biologi": "Sel, Fotosintesis & Respirasi, Ekosistem, Genetika (Mendel, DNA), Sistem Organ Manusia, Evolusi",
    "Kimia": "Struktur Atom, Ikatan Kimia, Stoikiometri & Mol, Larutan (asam-basa, pH), Reaksi Redoks, Laju Reaksi",
    "Bahasa Indonesia": "Tata Bahasa, Teks Argumentasi, Teks Narasi, Puisi, Cerpen, Ejaan & Tanda Baca",
    "Bahasa Inggris": "Grammar (tenses, passive voice), Reading Comprehension, Writing, Speaking expressions",
}

# Delay between Groq API calls (seconds) to respect free-tier rate limits
INTER_REQUEST_DELAY = 8


# ─── JSON extraction ──────────────────────────────────────────────────────────

def _extract_json(text: str) -> dict:
    """Extract first valid JSON object from AI text response."""
    if not text:
        return {}

    # Try direct parse first (ideal case)
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # Find first { ... } block (handles text before/after JSON)
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    # Try extracting from markdown code block
    match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    return {}


# ─── Main seeding logic ───────────────────────────────────────────────────────

def seed_faq_for_mapel(db, mata_kuliah: str, topics: str) -> int:
    """Generate and save FAQ for one mata_kuliah. Returns number inserted."""
    existing = db.query(models.TutorFAQ).filter(
        models.TutorFAQ.mata_kuliah == mata_kuliah
    ).count()

    if existing >= 10:
        logger.info("Skipping %s -- already has %d entries.", mata_kuliah, existing)
        return 0

    logger.info("Generating FAQ for %s ...", mata_kuliah)
    try:
        result = ai_service.generate(
            capability="chat",
            prompt_template=FAQ_GEN_PROMPT,
            input_variables={"mata_kuliah": mata_kuliah, "topics": topics},
            use_cache=False,      # never cache seed data
            output_schema=None,   # plain text; we parse JSON ourselves
            temperature=0.5,
        )
    except Exception as exc:
        logger.error("AI generation failed for %s: %s", mata_kuliah, exc)
        return 0

    if not isinstance(result, str) or not result.strip():
        logger.error("Empty or non-string result for %s", mata_kuliah)
        return 0

    data = _extract_json(result)
    faqs_data = data.get("faqs", [])

    if not faqs_data:
        logger.warning(
            "No FAQ entries parsed for %s. Raw snippet (first 300 chars): %s",
            mata_kuliah,
            result[:300],
        )
        return 0

    inserted = 0
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

    for item in faqs_data:
        if not isinstance(item, dict):
            continue

        topic = str(item.get("topic", "")).strip()
        keywords = item.get("keywords", [])
        if not isinstance(keywords, list):
            keywords = []
        question = str(item.get("question", "")).strip()
        answer = str(item.get("answer", "")).strip()
        difficulty = str(item.get("difficulty", "sedang")).strip().lower()

        if not question or not answer:
            continue

        if difficulty not in ("mudah", "sedang", "sulit"):
            difficulty = "sedang"

        faq = models.TutorFAQ(
            mata_kuliah=mata_kuliah,
            topic=topic,
            keywords_json=json.dumps(keywords, ensure_ascii=False),
            question=question,
            answer=answer,
            difficulty=difficulty,
            usage_count=0,
            effectiveness=80,
            created_at=now,
            updated_by="seed_script",
            last_updated=now,
        )
        db.add(faq)
        inserted += 1

    try:
        db.commit()
        logger.info("Inserted %d FAQ entries for %s.", inserted, mata_kuliah)
    except Exception as exc:
        db.rollback()
        logger.error("DB commit failed for %s: %s", mata_kuliah, exc)
        return 0

    return inserted


def seed_templates(db) -> int:
    """Seed formula templates if not already present."""
    existing = db.query(models.TutorTemplate).count()
    if existing >= len(FORMULA_TEMPLATES):
        logger.info("Templates already seeded (%d entries). Skipping.", existing)
        return 0

    inserted = 0
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    for t in FORMULA_TEMPLATES:
        tmpl = models.TutorTemplate(
            mata_kuliah=t["mata_kuliah"],
            type=t["type"],
            title=t["title"],
            content=t["content"],
            variables_json=t.get("variables_json"),
            usage_count=0,
            created_at=now,
        )
        db.add(tmpl)
        inserted += 1

    try:
        db.commit()
        logger.info("Inserted %d templates.", inserted)
    except Exception as exc:
        db.rollback()
        logger.error("Template commit failed: %s", exc)
        return 0

    return inserted


def main():
    db = SessionLocal()
    try:
        # 1. Seed templates first (no AI calls, fast)
        seed_templates(db)

        # 2. Seed FAQ per mapel with delay between API calls
        total = 0
        mapel_list = list(MAPEL_CONFIG.items())
        for i, (mata_kuliah, topics) in enumerate(mapel_list):
            n = seed_faq_for_mapel(db, mata_kuliah, topics)
            total += n
            # Delay between mapel calls (not after the last one, and only if AI was called)
            if i < len(mapel_list) - 1 and n > 0:
                logger.info("Waiting %ds before next API call...", INTER_REQUEST_DELAY)
                time.sleep(INTER_REQUEST_DELAY)

        # 3. Summary report
        final_count = db.query(models.TutorFAQ).count()
        template_count = db.query(models.TutorTemplate).count()
        logger.info("=" * 50)
        logger.info("Seed complete.")
        logger.info("  FAQ total in DB  : %d (inserted this run: %d)", final_count, total)
        logger.info("  Templates in DB  : %d", template_count)
        logger.info("=" * 50)

    finally:
        db.close()


if __name__ == "__main__":
    main()
