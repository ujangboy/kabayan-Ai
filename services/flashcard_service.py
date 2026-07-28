from services.ai_service import ai_service
from prompts.flashcard import FLASHCARD_PROMPT
from repositories.flashcard_repository import flashcard_repository
from schemas.ai_output import FlashcardOutput
from sqlalchemy.orm import Session
import json
import re

class FlashcardService:
    @staticmethod
    def generate_flashcards(db: Session, subject_id, context: str, title: str = None):
        import models
        import datetime

        result = ai_service.generate(
            capability="flashcard",
            prompt_template=FLASHCARD_PROMPT,
            input_variables={"context": context},
            use_cache=False,
            output_schema=FlashcardOutput,
        )

        try:
            if isinstance(result, dict) and "flashcards" in result:
                items = result["flashcards"]
            else:
                match = re.search(r'```json\s*([\s\S]*?)\s*```', result)
                if match:
                    json_str = match.group(1)
                else:
                    json_match = re.search(r'\[.*\]', result, re.DOTALL)
                    json_str = json_match.group(0) if json_match else result
                items = json.loads(json_str.strip())
                if isinstance(items, dict) and "flashcards" in items:
                    items = items["flashcards"]

            if not items:
                raise ValueError("AI tidak menghasilkan flashcard. Coba lagi.")

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

            db.flush()
            return len(items)

        except json.JSONDecodeError as e:
            raise ValueError(f"AI tidak mengembalikan JSON yang valid: {str(e)}\nResponse: {result[:300]}")
        except Exception as e:
            raise ValueError(f"Gagal menyimpan flashcard: {str(e)}")

    @staticmethod
    def get_by_subject(db: Session, subject_id: int):
        return flashcard_repository.get_by_subject(db, subject_id)

flashcard_service = FlashcardService()
