from services.ai_service import ai_service
from prompts.flashcard import FLASHCARD_PROMPT
from repositories.flashcard_repository import flashcard_repository
from sqlalchemy.orm import Session
import json
import re


def _sanitize_json_str(s: str) -> str:
    """Fix invalid LaTeX backslash escapes in AI-generated JSON strings."""
    s = re.sub(r'\\([^"\\bfnrtu/])', r'\\\\\1', s)
    s = re.sub(r',\s*([}\]])', r'\1', s)
    return s


def _extract_json(raw: str) -> str:
    """Extract JSON array or object from AI response using multiple strategies."""
    s = raw.strip()
    for pat in [r'```json\s*([\s\S]*?)\s*```', r'```\s*([\s\S]*?)\s*```']:
        m = re.search(pat, s)
        if m:
            return m.group(1).strip()
    start = s.find('[')
    if start >= 0:
        depth, end = 0, start
        for i, ch in enumerate(s[start:], start):
            if ch == '[': depth += 1
            elif ch == ']': depth -= 1
            if depth == 0:
                end = i + 1
                break
        if end > start:
            return s[start:end]
    start = s.find('{')
    if start >= 0:
        depth, end = 0, start
        for i, ch in enumerate(s[start:], start):
            if ch == '{': depth += 1
            elif ch == '}': depth -= 1
            if depth == 0:
                end = i + 1
                break
        if end > start:
            return s[start:end]
    return s


class FlashcardService:
    @staticmethod
    def generate_flashcards(db: Session, subject_id, context: str, count: int = 10, title: str = None):
        import models
        import datetime

        result = ai_service.generate(
            capability="flashcard",
            prompt_template=FLASHCARD_PROMPT,
            input_variables={"context": context, "count": count},
            use_cache=False,
        )

        try:
            json_str = _extract_json(str(result))
            json_str = _sanitize_json_str(json_str)
            items = json.loads(json_str)
            if isinstance(items, dict):
                items = items.get("flashcards", items.get("items", [items]))

            if not items:
                raise ValueError("AI tidak menghasilkan flashcard. Coba lagi.")

            count_created = 0
            for item in items:
                question = (item.get("question") or "").strip()
                answer = (item.get("answer") or "").strip()
                if not question or not answer:
                    continue
                fc = models.Flashcard(
                    subject_id=subject_id,
                    title=title,
                    question=question,
                    answer=answer,
                    created_at=datetime.datetime.utcnow(),
                )
                db.add(fc)
                count_created += 1

            db.flush()
            return count_created

        except (json.JSONDecodeError, Exception) as e:
            snippet = str(result)[:300] if result else ""
            raise ValueError(f"AI gagal: {e}\nResponse: {snippet}")

    @staticmethod
    def get_by_subject(db: Session, subject_id: int):
        return flashcard_repository.get_by_subject(db, subject_id)

flashcard_service = FlashcardService()
