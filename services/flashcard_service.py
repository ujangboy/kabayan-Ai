from services.ai_service import ai_service
from prompts.flashcard import FLASHCARD_PROMPT
from repositories.flashcard_repository import flashcard_repository
from sqlalchemy.orm import Session
import json
import re

class FlashcardService:
    @staticmethod
    def generate_flashcards(db: Session, subject_id, context: str, title: str = None):
        """Generate flashcards dari context, simpan ke DB, return jumlah yang dibuat."""
        response = ai_service.generate(
            capability="flashcard",
            prompt_template=FLASHCARD_PROMPT,
            input_variables={"context": context},
            use_cache=False
        )

        try:
            # Proteksi Output Parsing (JSON Guard)
            match = re.search(r'```json\s*([\s\S]*?)\s*```', response)
            if match:
                json_str = match.group(1)
            else:
                json_match = re.search(r'\[.*\]', response, re.DOTALL)
                json_str = json_match.group(0) if json_match else response
            data = json.loads(json_str.strip())

            if not data:
                raise ValueError("AI tidak menghasilkan flashcard. Coba lagi.")

            # Bulk insert — tambahkan semua ke session dulu, baru commit sekali
            import models
            import datetime
            for item in data:
                question = item.get("question", "").strip()
                answer = item.get("answer", "").strip()
                if not question or not answer:
                    continue  # skip item kosong
                fc = models.Flashcard(
                    subject_id=subject_id,
                    title=title,
                    question=question,
                    answer=answer,
                    created_at=datetime.datetime.utcnow(),
                )
                db.add(fc)

            db.commit()  # satu commit untuk semua
            return len(data)

        except json.JSONDecodeError as e:
            raise ValueError(f"AI tidak mengembalikan JSON yang valid: {str(e)}\nResponse: {response[:300]}")
        except Exception as e:
            db.rollback()
            raise ValueError(f"Gagal menyimpan flashcard: {str(e)}")

    @staticmethod
    def get_by_subject(db: Session, subject_id: int):
        return flashcard_repository.get_by_subject(db, subject_id)

flashcard_service = FlashcardService()
