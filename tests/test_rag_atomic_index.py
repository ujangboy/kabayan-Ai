"""Regression: kegagalan embedding tidak boleh menghapus chunk lama."""
import pytest

from services.rag_service import RAGService


class _ExplodingEmbedder:
    def embed_documents(self, _texts):
        raise RuntimeError("embedding provider down")


def test_index_document_keeps_old_chunks_when_embedding_fails():
    svc = RAGService()
    svc._loaded = True
    svc._cached_model_name = "fake-embedding-model"
    svc.dimension = 3
    svc.chunk_metadata = [{
        "id": 7,
        "doc_id": "mat_1",
        "content": "chunk lama",
        "deleted": False,
    }]
    svc.doc_to_chunk_indices = {"mat_1": [7]}
    svc._get_embedder = lambda: _ExplodingEmbedder()

    with pytest.raises(RuntimeError, match="embedding provider down"):
        svc.index_document("mat_1", ["chunk baru"])

    # Chunk lama harus tetap ada dan belum ditandai deleted.
    assert svc.doc_to_chunk_indices["mat_1"] == [7]
    assert svc.chunk_metadata[0]["deleted"] is False
