"""Deduplicated context assembly for RAG-backed generation endpoints."""
import logging
from app.services.rag_service import rag_service

logger = logging.getLogger(__name__)

class RAGContextService:
    def gather_context(self, materials: list, max_words: int = 1500, query: str = None) -> str:
        doc_ids = [f"mat_{m.id}" for m in materials if m.status == "Ready"]
        if not doc_ids:
            return ""

        context = ""

        # Strategy 1: vector search if query provided (semantic ranking)
        # rag_service.search sudah lazy-load + aman jika index kosong (B1/B8)
        if query:
            result = rag_service.search(query, doc_ids, top_k=20)
            retrieved = result.get("text", "")
            if retrieved:
                word_count = len(retrieved.split())
                if word_count >= max_words * 0.5:
                    return self._truncate(retrieved, max_words)
                context = retrieved

        # Strategy 2: gather all chunks from selected materials (fallback / supplement)
        if not context or len(context.split()) < max_words:
            extra = self._gather_chunks(doc_ids, max_words)
            if extra:
                context = (context + "\n\n---\n\n" + extra) if context else extra
            context = self._truncate(context, max_words)

        # Strategy 3: fallback file parsing
        if not context.strip():
            context = self._fallback_read(materials, max_words)

        return context

    def _gather_chunks(self, doc_ids: list, max_words: int) -> str:
        with rag_service._lock:
            parts = []
            count = 0
            for meta in rag_service.chunk_metadata:
                if meta["doc_id"] in doc_ids:
                    parts.append(meta["content"])
                    count += len(meta["content"].split())
                    if count >= max_words:
                        break
        return "\n\n".join(parts)

    def _fallback_read(self, materials: list, max_words: int) -> str:
        from app.parsers.document_parser import extract_text
        import os
        parts = []
        count = 0
        for m in materials:
            if m.filepath and os.path.exists(m.filepath) and m.status == "Ready":
                try:
                    text = extract_text(m.filepath)
                    if text:
                        words = text.split()
                        take = words[:max_words - count]
                        parts.append(" ".join(take))
                        count += len(take)
                except Exception as exc:
                    logger.warning("Fallback read failed for %s: %s", m.filepath, exc)
            if count >= max_words:
                break
        return "\n\n".join(parts)

    def _truncate(self, text: str, max_words: int) -> str:
        words = text.split()
        if len(words) <= max_words:
            return text
        return " ".join(words[:max_words])

rag_context_service = RAGContextService()