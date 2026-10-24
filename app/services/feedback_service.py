"""
Feedback Service untuk AI Tutor Kabayan AI.

Menyimpan rating siswa terhadap respons tutor (helpful / somewhat / not_helpful)
beserta flag & komentar opsional, lalu menghitung statistik helpful_rate.

Catatan:
- Aplikasi single-user lokal → user_key default "local".
- message_id wajib valid (kunci utama). chat_id diturunkan dari pesan agar
  tidak pernah melanggar foreign key (PRAGMA foreign_keys=ON diaktifkan).
- Rating duplikat untuk message yang sama akan di-update (bukan duplikat).
"""
from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.orm import Session

from app import models

logger = logging.getLogger(__name__)

VALID_RATINGS = ("helpful", "somewhat", "not_helpful")
VALID_FLAGS = ("incorrect", "unclear", "irrelevant", "inappropriate")

# Alias dari client lama agar tidak 400 (frontend mengirim up/down).
RATING_ALIASES = {"up": "helpful", "down": "not_helpful", "like": "helpful"}


class FeedbackService:

    def save_feedback(
        self,
        db: Session,
        *,
        message_id: int,
        rating: str,
        chat_id: Optional[int] = None,
        user_key: str = "local",
        comment: Optional[str] = None,
        flag: Optional[str] = None,
    ) -> dict:
        """Simpan/update feedback untuk satu pesan tutor."""
        rating = RATING_ALIASES.get(rating, rating)
        if rating not in VALID_RATINGS:
            raise ValueError(
                f"Rating tidak valid: '{rating}'. Pilihan: helpful / somewhat / not_helpful."
            )
        if flag is not None and flag not in VALID_FLAGS:
            raise ValueError(
                f"Flag tidak valid: '{flag}'. Pilihan: incorrect / unclear / irrelevant / inappropriate."
            )

        # message_id wajib menunjuk pesan yang nyata (FK safety)
        msg = db.query(models.Message).filter(models.Message.id == message_id).first()
        if not msg:
            raise ValueError(f"Pesan dengan id {message_id} tidak ditemukan.")
        resolved_chat_id = chat_id or msg.chat_id

        existing = (
            db.query(models.TutorFeedback)
            .filter(
                models.TutorFeedback.message_id == message_id,
                models.TutorFeedback.user_key == user_key,
            )
            .first()
        )

        if existing:
            existing.rating = rating
            existing.comment = comment
            existing.flag = flag
        else:
            feedback = models.TutorFeedback(
                message_id=message_id,
                chat_id=resolved_chat_id,
                user_key=user_key,
                rating=rating,
                comment=comment,
                flag=flag,
            )
            db.add(feedback)
        db.commit()

        return {
            "success": True,
            "message": "Terima kasih atas feedback-nya!",
            "impact": self._feedback_stats(db, user_key),
        }

    def _feedback_stats(self, db: Session, user_key: str = "local") -> dict:
        """Hitung agregat rating dari semua feedback pengguna."""
        rows = (
            db.query(models.TutorFeedback)
            .filter(models.TutorFeedback.user_key == user_key)
            .all()
        )
        helpful = sum(1 for r in rows if r.rating == "helpful")
        somewhat = sum(1 for r in rows if r.rating == "somewhat")
        not_helpful = sum(1 for r in rows if r.rating == "not_helpful")
        total = helpful + somewhat + not_helpful
        helpful_rate = round(helpful / total, 4) if total else 0.0
        return {
            "helpful_count": helpful,
            "somewhat_count": somewhat,
            "not_helpful_count": not_helpful,
            "total": total,
            "helpful_rate": helpful_rate,
        }


feedback_service = FeedbackService()
