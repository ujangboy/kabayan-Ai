from services.ai_service import ai_service
from prompts.flashcard import FLASHCARD_PROMPT
from repositories.flashcard_repository import flashcard_repository
from services.json_utils import parse_ai_json
from services.ai_schemas import FlashcardItem
from pydantic import ValidationError
from sqlalchemy.orm import Session


class FlashcardService:
    # Rating SRS: 0=Lupa, 1=Sulit, 2=Biasa, 3=Mudah, 4=Sempurna
    def apply_review(self, db: Session, flashcard, rating: int, response_time_ms: int = None):
        """Update field SRS kartu berdasarkan rating user (SM-2 sederhana)."""
        import models
        import datetime

        now = datetime.datetime.utcnow()
        rating = max(0, min(4, int(rating)))

        ease = flashcard.ease_factor if flashcard.ease_factor is not None else 250
        interval = flashcard.interval if flashcard.interval is not None else 1

        rerun = False

        if rating == 0:      # Lupa — reset, review lagi di sesi yang sama
            interval = 1
            ease = max(130, ease - 20)
            rerun = True
        elif rating == 1:    # Sulit — interval pendek, review lagi di sesi yang sama
            interval = max(1, round(interval * 1.2))
            ease = max(130, ease - 15)
            rerun = True
        elif rating == 2:    # Biasa
            interval = 1 if interval <= 1 else 3 if interval <= 3 else round(interval * (ease / 100))
            interval = max(1, interval)
        elif rating == 3:    # Mudah
            interval = max(2, round(interval * (ease / 100) * 1.1))
            ease = min(400, ease + 5)
        else:                # Sempurna
            interval = max(3, round(interval * (ease / 100) * 1.3))
            ease = min(400, ease + 10)

        flashcard.ease_factor = ease
        flashcard.interval = interval
        # Rating rendah (0-1): next_review = now agar kartu tetap due di sesi ini
        # Rating tinggi (2-4): next_review = now + interval (jadwal normal)
        if rerun:
            flashcard.next_review = now
        else:
            flashcard.next_review = now + datetime.timedelta(days=interval)
        flashcard.times_seen = (flashcard.times_seen or 0) + 1
        flashcard.times_correct = (flashcard.times_correct or 0) + (1 if rating >= 2 else 0)
        flashcard.last_reviewed = now
        flashcard.mastered = 1 if interval >= 21 else 0

        review = models.FlashcardReview(
            flashcard_id=flashcard.id,
            rating=rating,
            reviewed_at=now,
            next_review=flashcard.next_review,
        )
        if response_time_ms is not None:
            review.response_time_ms = response_time_ms
        db.add(review)
        db.flush()

        return {
            "interval_days": interval,
            "next_review": flashcard.next_review.isoformat(),
            "mastered": flashcard.mastered,
            "rerun": rerun,
        }

    def generate_flashcards(self, db: Session, subject_id, context: str, count: int = 10, title: str = None, material_ids: str = None):
        import models
        import datetime
        import uuid

        result = ai_service.generate(
            capability="flashcard",
            prompt_template=FLASHCARD_PROMPT,
            input_variables={"context": context, "count": count},
            use_cache=True,
            temperature=0.7,
        )

        try:
            items = parse_ai_json(result, "Flashcard AI")
            if isinstance(items, dict):
                items = items.get("flashcards", items.get("items", [items]))

            if not items:
                raise ValueError("AI tidak menghasilkan flashcard. Coba lagi.")

            now = datetime.datetime.utcnow()
            # Selalu generate batch_id baru — tidak pernah dari parameter luar
            # agar setiap Generate AI menghasilkan deck yang benar-benar terpisah
            generated_batch_id = str(uuid.uuid4())
            count_created = 0
            for item in items:
                # B3: validasi struktur tiap kartu dengan Pydantic schema
                try:
                    valid = FlashcardItem.model_validate(item)
                except ValidationError:
                    continue
                question = (valid.question or valid.front or "").strip()
                answer = (valid.answer or valid.back or "").strip()
                if not question or not answer:
                    continue
                fc = models.Flashcard(
                    subject_id=subject_id,
                    title=title,
                    batch_id=generated_batch_id,
                    question=question,
                    answer=answer,
                    material_ids=material_ids,
                    created_at=now,
                    next_review=now + datetime.timedelta(days=1),
                    interval=1,
                    ease_factor=250,
                    times_seen=0,
                    times_correct=0,
                    mastered=0,
                )
                db.add(fc)
                count_created += 1

            db.flush()

            # Validasi jumlah: jika AI menghasilkan kurang dari 50% yang diminta, lempar error
            if count_created < max(1, count // 2):
                raise ValueError(
                    f"AI hanya menghasilkan {count_created} dari {count} flashcard yang diminta. "
                    "Coba lagi atau kurangi jumlah flashcard."
                )

            return {"count": count_created, "batch_id": generated_batch_id}

        except (ValueError, Exception) as e:
            snippet = str(result)[:300] if result else ""
            raise ValueError(f"AI gagal: {e}\nResponse: {snippet}")

flashcard_service = FlashcardService()
