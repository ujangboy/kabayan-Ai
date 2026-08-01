from services.ai_service import ai_service
from prompts.flashcard import FLASHCARD_PROMPT
from repositories.flashcard_repository import flashcard_repository
from services.json_utils import parse_ai_json
from sqlalchemy.orm import Session


class FlashcardService:
    @staticmethod
    def generate_flashcards(db: Session, subject_id, context: str, count: int = 10, title: str = None, material_ids: str = None):
        import models
        import datetime

        result = ai_service.generate(
            capability="flashcard",
            prompt_template=FLASHCARD_PROMPT,
            input_variables={"context": context, "count": count},
            use_cache=False,
            temperature=0.7,
        )

        try:
            items = parse_ai_json(result, "Flashcard AI")
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
                    material_ids=material_ids,
                    created_at=datetime.datetime.utcnow(),
                )
                db.add(fc)
                count_created += 1

            db.flush()
            return count_created

        except (ValueError, Exception) as e:
            snippet = str(result)[:300] if result else ""
            raise ValueError(f"AI gagal: {e}\nResponse: {snippet}")

flashcard_service = FlashcardService()
