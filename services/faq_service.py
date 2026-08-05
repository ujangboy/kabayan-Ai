"""
FAQ Service for Kabayan AI Tutor.

Handles:
- Fuzzy keyword-based lookup against tutor_faq table (0 token cost)
- Template lookup for enriching SIMPLE responses
- Usage count tracking

Lookup strategy:
  1. Exact or partial keyword match against FAQ.keywords_json
  2. Fallback: substring match on FAQ.question
  3. Return best match (highest keyword overlap), or None
"""
from __future__ import annotations

import json
import logging
import re
from typing import Optional

from sqlalchemy.orm import Session

import models

logger = logging.getLogger(__name__)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"(\w)'(\w)", r"\1\2", text)   # l'hopital → lhopital
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text)


def _keyword_overlap(norm_message: str, keywords: list[str]) -> int:
    """Count how many FAQ keywords appear in the normalized message."""
    count = 0
    for kw in keywords:
        if _normalize(kw) in norm_message:
            count += 1
    return count


# ─── FAQ Service ─────────────────────────────────────────────────────────────

class FAQService:

    def find_best_match(
        self,
        db: Session,
        message: str,
        mata_kuliah: Optional[str] = None,
        min_overlap: int = 1,
    ) -> Optional[models.TutorFAQ]:
        """
        Find the best-matching FAQ entry for a student message.

        Args:
            db:          SQLAlchemy session.
            message:     Student message (raw, will be normalized internally).
            mata_kuliah: Optional subject filter (e.g. "Matematika").
            min_overlap: Minimum keyword overlap to consider a match.

        Returns:
            Best-matching TutorFAQ row, or None if no match found.
        """
        norm_msg = _normalize(message)

        query = db.query(models.TutorFAQ)
        if mata_kuliah:
            query = query.filter(models.TutorFAQ.mata_kuliah == mata_kuliah)

        faqs = query.all()
        if not faqs:
            return None

        best: Optional[models.TutorFAQ] = None
        best_score = 0

        for faq in faqs:
            try:
                keywords: list[str] = json.loads(faq.keywords_json or "[]")
            except (json.JSONDecodeError, TypeError):
                keywords = []

            overlap = _keyword_overlap(norm_msg, keywords)

            # Also give partial credit for question text substring match
            faq_norm = _normalize(faq.question or "")
            # Check if ≥2 words from the FAQ question appear in the message
            faq_words = [w for w in faq_norm.split() if len(w) > 3]
            question_match = sum(1 for w in faq_words if w in norm_msg)
            question_score = 1 if question_match >= 2 else 0

            total = overlap + question_score

            if total > best_score:
                best_score = total
                best = faq

        if best_score < min_overlap:
            return None

        return best

    def record_usage(self, db: Session, faq_id: int) -> None:
        """Increment usage_count for analytics."""
        try:
            faq = db.query(models.TutorFAQ).filter(models.TutorFAQ.id == faq_id).first()
            if faq:
                faq.usage_count = (faq.usage_count or 0) + 1
                db.commit()
        except Exception as exc:
            logger.warning("faq_service.record_usage failed: %s", exc)
            db.rollback()

    def find_template(
        self,
        db: Session,
        mata_kuliah: str,
        template_type: str = "formula",
    ) -> Optional[models.TutorTemplate]:
        """Return a random template for the given subject and type."""
        return (
            db.query(models.TutorTemplate)
            .filter(
                models.TutorTemplate.mata_kuliah == mata_kuliah,
                models.TutorTemplate.type == template_type,
            )
            .first()
        )

    def get_all_faq(
        self,
        db: Session,
        mata_kuliah: Optional[str] = None,
        limit: int = 100,
    ) -> list[models.TutorFAQ]:
        """List FAQs, optionally filtered by subject."""
        query = db.query(models.TutorFAQ)
        if mata_kuliah:
            query = query.filter(models.TutorFAQ.mata_kuliah == mata_kuliah)
        return query.order_by(models.TutorFAQ.usage_count.desc()).limit(limit).all()

    def count(self, db: Session) -> int:
        return db.query(models.TutorFAQ).count()


faq_service = FAQService()
