"""Tests untuk RAG lazy delete optimization.

Run: pytest tests/test_rag_delete.py -v
     pytest tests/test_rag_delete.py -v -k "performance"
"""

import os
import time
import json
import sys
import tempfile
import numpy as np
from unittest.mock import patch, MagicMock

import pytest

# Mock slow imports BEFORE importing services.rag_service
sys.modules['langchain_huggingface'] = MagicMock()
sys.modules['langchain_huggingface'].HuggingFaceEmbeddings = MagicMock

# Mock setting service (database)
mock_settings = MagicMock()
mock_settings.get_embedding_model.return_value = "test-model"
sys.modules['services.settings_service'] = MagicMock()
sys.modules['services.settings_service'].settings_service = mock_settings

# Mock database session
sys.modules['database'] = MagicMock()
sys.modules['database'].SessionLocal.return_value.__enter__.return_value = MagicMock()

# Mock config values
sys.modules['config'] = MagicMock()
sys.modules['config'].FAISS_INDEX_DIR = tempfile.mkdtemp()


# ── Mock FAISS ──────────────────────────────────────────────────────

class FakeIndex:
    """Fake FAISS index untuk testing tanpa actual FAISS."""
    def __init__(self, d=384):
        self.d = d
        self.ntotal = 0
        self._vectors = []

    def add(self, x):
        n = x.shape[0]
        self._vectors.append(x)
        self.ntotal += n

    def search(self, x, k):
        k = min(k, self.ntotal)
        if k == 0:
            return np.array([[]]), np.array([[]])
        indices = np.arange(min(k, self.ntotal)).reshape(1, -1)
        distances = np.zeros_like(indices, dtype=np.float32)
        return distances, indices

    def __getstate__(self):
        return {"d": self.d, "ntotal": self.ntotal}

    def __setstate__(self, state):
        self.d = state["d"]
        self.ntotal = state["ntotal"]


def _fake_write_index(index, filepath):
    """Write FakeIndex state to disk so _load_index can read it back."""
    import pickle
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'wb') as f:
        pickle.dump(index.__getstate__(), f)


def _fake_read_index(filepath):
    """Read FakeIndex from disk."""
    import pickle
    with open(filepath, 'rb') as f:
        state = pickle.load(f)
    idx = FakeIndex(state["d"])
    idx.ntotal = state["ntotal"]
    return idx


fake_faiss = MagicMock()
fake_faiss.write_index.side_effect = _fake_write_index
fake_faiss.read_index.side_effect = _fake_read_index
fake_faiss.IndexFlatL2 = FakeIndex
sys.modules['faiss'] = fake_faiss


# ── Test Helper ─────────────────────────────────────────────────────

def _make_rag_service():
    """Buat RAGService instance dengan semua dependency dimock."""
    from services.rag_service import RAGService as RSR
    svc = RSR()

    # Replace embedder with mock
    mock_embedder = MagicMock()
    mock_embedder.embed_documents.side_effect = (
        lambda x: [np.random.rand(384).tolist() for _ in x]
    )
    mock_embedder.embed_query.side_effect = (
        lambda x: np.random.rand(384).tolist()
    )
    svc._get_embedder = MagicMock(return_value=mock_embedder)

    # Use temp paths
    tmp = tempfile.mkdtemp()
    svc.index_path = os.path.join(tmp, "test.index")
    svc.metadata_path = os.path.join(tmp, "test_metadata.json")
    svc.doc_index_path = os.path.join(tmp, "test_doc_index.json")
    svc._rebuild_threshold = 0.5

    # Start with clean state
    svc.index = FakeIndex(384)
    svc.dimension = 384
    svc.chunk_metadata = []
    svc.doc_to_chunk_indices = {}
    svc._deleted_doc_ids = set()

    return svc


def _add_docs(svc, count=3):
    """Add test documents to service."""
    docs = {
        "doc_1": ["Chunk 1A tentang AI", "Chunk 1B tentang Machine Learning"],
        "doc_2": ["Chunk 2A tentang Database", "Chunk 2B tentang SQL"],
        "doc_3": ["Chunk 3A tentang Python", "Chunk 3B tentang FastAPI"],
    }
    for doc_id, chunks in docs.items():
        if count <= 0:
            break
        svc.index_document(doc_id, chunks)
        count -= 1
    return svc


# ── Test: Delete is O(1) ────────────────────────────────────────────

class TestDeletePerformance:
    def test_delete_is_fast(self):
        """Delete harus <100ms."""
        svc = _make_rag_service()
        _add_docs(svc)
        start = time.perf_counter()
        svc.delete_document_chunks("doc_1")
        elapsed = time.perf_counter() - start
        assert elapsed < 0.1, f"Delete took {elapsed:.3f}s"

    def test_delete_does_not_rebuild(self):
        """Delete tidak boleh mengubah FAISS ntotal."""
        svc = _make_rag_service()
        _add_docs(svc)
        original_ntotal = svc.index.ntotal
        svc.delete_document_chunks("doc_1")
        assert svc.index.ntotal == original_ntotal

    def test_delete_multiple_consecutive(self):
        """Delete berturut-turut harus tetap cepat."""
        svc = _make_rag_service()
        _add_docs(svc)
        times = []
        for doc_id in ["doc_1", "doc_2"]:
            start = time.perf_counter()
            svc.delete_document_chunks(doc_id)
            times.append(time.perf_counter() - start)
        assert all(t < 0.1 for t in times)


# ── Test: Lazy Rebuild Tracking ─────────────────────────────────────

class TestLazyRebuild:
    def test_tracks_deleted_doc_ids(self):
        svc = _make_rag_service()
        _add_docs(svc)
        svc.delete_document_chunks("doc_1")
        assert "doc_1" in svc._deleted_doc_ids

    def test_removes_from_doc_index(self):
        svc = _make_rag_service()
        _add_docs(svc)
        assert "doc_1" in svc.doc_to_chunk_indices
        svc.delete_document_chunks("doc_1")
        assert "doc_1" not in svc.doc_to_chunk_indices

    def test_metadata_marked_deleted(self):
        svc = _make_rag_service()
        _add_docs(svc)
        svc.delete_document_chunks("doc_1")
        for meta in svc.chunk_metadata:
            if meta["doc_id"] == "doc_1":
                assert meta.get("deleted") is True
                assert "deleted_at" in meta

    def test_delete_idempotent(self):
        svc = _make_rag_service()
        _add_docs(svc)
        svc.delete_document_chunks("doc_1")
        svc.delete_document_chunks("doc_1")
        assert "doc_1" in svc._deleted_doc_ids


# ── Test: Search Ignores Deleted ───────────────────────────────────

class TestSearchIgnoresDeleted:
    def test_excludes_deleted_chunks(self):
        svc = _make_rag_service()
        _add_docs(svc)
        svc.delete_document_chunks("doc_1")
        result = svc.search("AI", top_k=10)
        assert "Chunk 1A" not in result
        assert "Chunk 1B" not in result

    def test_still_returns_active(self):
        svc = _make_rag_service()
        _add_docs(svc)
        svc.delete_document_chunks("doc_1")
        result = svc.search("test", top_k=10)
        assert "Chunk 2A" in result
        assert "Chunk 3A" in result

    def test_with_active_doc_ids_filter(self):
        svc = _make_rag_service()
        _add_docs(svc)
        svc.delete_document_chunks("doc_1")
        result = svc.search("test", active_doc_ids=["doc_2"], top_k=10)
        assert "Chunk 2A" in result
        assert "Chunk 3A" not in result

    def test_all_deleted_returns_empty(self):
        svc = _make_rag_service()
        _add_docs(svc)
        for doc_id in ["doc_1", "doc_2", "doc_3"]:
            svc.delete_document_chunks(doc_id)
        result = svc.search("test", top_k=10)
        assert result == ""


# ── Test: Manual Rebuild ────────────────────────────────────────────

class TestManualRebuild:
    def test_rebuild_removes_deleted(self):
        svc = _make_rag_service()
        _add_docs(svc)
        original_count = len(svc.chunk_metadata)
        svc.delete_document_chunks("doc_1")
        svc.rebuild_index()
        assert "doc_1" not in svc.doc_to_chunk_indices
        assert len(svc.chunk_metadata) < original_count
        assert len(svc._deleted_doc_ids) == 0

    def test_rebuild_preserves_active(self):
        svc = _make_rag_service()
        _add_docs(svc)
        svc.delete_document_chunks("doc_1")
        svc.rebuild_index()
        result = svc.search("test", top_k=10)
        assert "Chunk 2A" in result
        assert "Chunk 3A" in result

    def test_rebuild_all_deleted_clears_index(self):
        svc = _make_rag_service()
        _add_docs(svc)
        for doc_id in ["doc_1", "doc_2", "doc_3"]:
            svc.delete_document_chunks(doc_id)
        svc.rebuild_index()
        assert svc.index is None
        assert len(svc.chunk_metadata) == 0

    def test_rebuild_restores_doc_index(self):
        svc = _make_rag_service()
        _add_docs(svc)
        svc.delete_document_chunks("doc_1")
        svc.rebuild_index()
        assert "doc_2" in svc.doc_to_chunk_indices
        assert "doc_3" in svc.doc_to_chunk_indices
        doc2_idx = svc.doc_to_chunk_indices["doc_2"]
        doc3_idx = svc.doc_to_chunk_indices["doc_3"]
        assert doc2_idx == [0, 1], f"Got {doc2_idx}"
        assert doc3_idx == [2, 3], f"Got {doc3_idx}"


# ── Test: Rebuild Threshold ─────────────────────────────────────────

class TestRebuildThreshold:
    def test_below_threshold(self):
        svc = _make_rag_service()
        _add_docs(svc, count=5)
        svc.delete_document_chunks("doc_1")
        assert not svc._should_rebuild()

    def test_above_threshold(self):
        svc = _make_rag_service()
        _add_docs(svc, count=5)
        svc.delete_document_chunks("doc_1")
        svc.delete_document_chunks("doc_2")
        assert svc._should_rebuild()


# ── Test: Stats ─────────────────────────────────────────────────────

class TestStats:
    def test_stats_basic(self):
        svc = _make_rag_service()
        _add_docs(svc)
        stats = svc.get_stats()
        assert stats["total_chunks"] == 6
        assert stats["active_chunks"] == 6
        assert stats["deleted_chunks"] == 0
        assert stats["total_documents"] == 3

    def test_stats_after_delete(self):
        svc = _make_rag_service()
        _add_docs(svc)
        svc.delete_document_chunks("doc_1")
        stats = svc.get_stats()
        assert stats["total_chunks"] == 6
        assert stats["active_chunks"] == 4
        assert stats["deleted_chunks"] == 2
        assert stats["deleted_documents"] == 1
        assert stats["active_documents"] == 2

    def test_stats_after_rebuild(self):
        svc = _make_rag_service()
        _add_docs(svc)
        svc.delete_document_chunks("doc_1")
        svc.rebuild_index()
        stats = svc.get_stats()
        assert stats["total_chunks"] == 4
        assert stats["deleted_chunks"] == 0


# ── Test: Persistence ──────────────────────────────────────────────

class TestPersistence:
    def test_save_and_load_preserves_state(self):
        svc = _make_rag_service()
        _add_docs(svc)
        svc.delete_document_chunks("doc_1")
        svc.save_index()

        new_svc = _make_rag_service()
        new_svc.index_path = svc.index_path
        new_svc.metadata_path = svc.metadata_path
        new_svc.doc_index_path = svc.doc_index_path
        new_svc._load_index()

        assert "doc_1" not in new_svc.doc_to_chunk_indices
        assert len(new_svc.chunk_metadata) == 6


# ── Test: Concurrency ──────────────────────────────────────────────

class TestConcurrency:
    def test_concurrent_delete_and_search(self):
        svc = _make_rag_service()
        _add_docs(svc)
        import threading

        errors = []

        def delete_worker():
            try:
                import time
                time.sleep(0.1)
                svc.delete_document_chunks("doc_1")
            except Exception as e:
                errors.append(f"delete: {e}")

        def search_worker():
            try:
                for _ in range(5):
                    svc.search("test", top_k=3)
                    import time
                    time.sleep(0.05)
            except Exception as e:
                errors.append(f"search: {e}")

        threads = [
            threading.Thread(target=delete_worker),
            threading.Thread(target=search_worker),
            threading.Thread(target=search_worker),
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=5)

        assert not errors, f"Errors: {errors}"
        assert "doc_1" in svc._deleted_doc_ids


# ── Test: Performance Metrics (slow) ───────────────────────────────

class TestPerformanceMetrics:
    def test_large_index_delete(self):
        """Dengan 100 docs x 10 chunks = 1000 chunks, delete <100ms."""
        svc = _make_rag_service()
        for i in range(100):
            chunks = [f"chunk_{i}_{j}" for j in range(10)]
            svc.index_document(f"doc_{i}", chunks)

        times = []
        for i in range(10):
            start = time.perf_counter()
            svc.delete_document_chunks(f"doc_{i}")
            times.append(time.perf_counter() - start)

        avg_time = sum(times) / len(times)
        assert avg_time < 0.1, f"Average delete: {avg_time:.3f}s"

    def test_delete_time_constant_per_delete(self):
        """Delete time harus konstan (O(1)), tidak peduli index size.

        Measures only the delete_document_chunks call, not setup.
        """
        svc = _make_rag_service()
        for i in range(500):
            svc.index_document(f"doc_{i}", [f"chunk_{i}"])

        # Measure first delete
        start = time.perf_counter()
        svc.delete_document_chunks("doc_0")
        t_first = time.perf_counter() - start

        # Measure delete at large index
        start = time.perf_counter()
        svc.delete_document_chunks("doc_499")
        t_last = time.perf_counter() - start

        assert max(t_first, t_last) < 0.1, f"Delete took {max(t_first, t_last):.3f}s"