import os
import json
import hashlib
import numpy as np
import faiss
import threading
import datetime
from langchain_huggingface import HuggingFaceEmbeddings
import config
from services.settings_service import settings_service
from database import SessionLocal


def _embedding_model_version(model_name: str) -> str:
    """Derive a short version string from model name + dimension."""
    h = hashlib.md5(model_name.encode()).hexdigest()[:8]
    return f"{model_name.replace('/', '_')}-{h}"


class RAGService:
    """RAG Service dengan lazy deletion (O(1)) + model versioning.

    Key features:
    - delete_document_chunks() O(1) — metadata update only, no FAISS rebuild
    - rebuild_index() for manual/on-demand compaction
    - Search skips deleted documents automatically
    - Model versioning per chunk for compatibility checking
    - Thread-safe operations
    """

    def __init__(self):
        self.dimension = 384
        self.chunk_metadata = []
        self.index = None
        self.index_path = os.path.join(config.FAISS_INDEX_DIR, "main.index")
        self.metadata_path = os.path.join(config.FAISS_INDEX_DIR, "metadata.json")
        self.doc_index_path = os.path.join(config.FAISS_INDEX_DIR, "doc_index.json")

        self.doc_to_chunk_indices = {}
        self._deleted_doc_ids = set()
        self._rebuild_threshold = 0.3
        self._dirty = False

        self._cached_embedder = None
        self._cached_model_name = None
        self._lock = threading.RLock()
        self._load_index()

    # ── Embedder ──────────────────────────────────────────────────────

    def _get_embedder(self):
        db = SessionLocal()
        model_name = settings_service.get_embedding_model(db)
        db.close()

        if self._cached_embedder is None or self._cached_model_name != model_name:
            self._cached_embedder = HuggingFaceEmbeddings(model_name=model_name)
            self._cached_model_name = model_name

        return self._cached_embedder

    def get_embedding_model_name(self) -> str:
        """Return the currently active embedding model name."""
        return self._cached_model_name or settings_service.get_embedding_model(SessionLocal())

    def get_embedding_model_version(self) -> str:
        """Return version string for the active model."""
        return _embedding_model_version(self.get_embedding_model_name())

    def check_model_compatibility(self) -> dict:
        """Check if all indexed chunks are compatible with the current model.

        Returns:
            dict with status, current_model, index_model, chunk_count
        """
        current_model = self.get_embedding_model_name()
        current_ver = self.get_embedding_model_version()
        index_models = set()

        for meta in self.chunk_metadata:
            stored = meta.get("model_name") or meta.get("model_version") or "unknown"
            index_models.add(stored)

        if not index_models:
            return {"status": "empty", "current_model": current_model, "current_version": current_ver}

        all_compatible = index_models == {current_ver} or index_models == {current_model}
        return {
            "status": "compatible" if all_compatible else "incompatible",
            "current_model": current_model,
            "current_version": current_ver,
            "index_models": list(index_models),
            "chunk_count": len(self.chunk_metadata),
            "needs_reindex": not all_compatible,
        }

    # ── Persistence ───────────────────────────────────────────────────

    def _load_index(self):
        with self._lock:
            if os.path.exists(self.index_path):
                self.index = faiss.read_index(self.index_path)
                with open(self.metadata_path, 'r', encoding='utf-8') as f:
                    self.chunk_metadata = json.load(f)
                self.dimension = self.index.d
            else:
                self.index = None
                self.chunk_metadata = []

            if os.path.exists(self.doc_index_path):
                with open(self.doc_index_path, 'r', encoding='utf-8') as f:
                    self.doc_to_chunk_indices = json.load(f)

    def save_index(self):
        with self._lock:
            os.makedirs(config.FAISS_INDEX_DIR, exist_ok=True)
            if self.index is not None:
                faiss.write_index(self.index, self.index_path)
            with open(self.metadata_path, 'w', encoding='utf-8') as f:
                json.dump(self.chunk_metadata, f, ensure_ascii=False)
            with open(self.doc_index_path, 'w', encoding='utf-8') as f:
                json.dump(self.doc_to_chunk_indices, f, ensure_ascii=False)
            self._dirty = False

    # ── Index Document (with model tracking) ─────────────────────────

    def index_document(self, doc_id: str, chunks: list):
        """Index document baru. O(k) dimana k = jumlah chunks.

        Each chunk's metadata includes model_name and model_version
        so we can detect drift when the embedding model changes.
        """
        if not chunks:
            return

        # Pastikan hapus chunk lama (jika ada) untuk menghindari ghost chunks 
        # dari ID yang sama jika database di-reset.
        self.delete_document_chunks(doc_id)

        embedder = self._get_embedder()
        model_name = self.get_embedding_model_name()
        model_version = self.get_embedding_model_version()

        texts_to_embed = []
        metadata_entries = []
        for c in chunks:
            if hasattr(c, 'content'):
                texts_to_embed.append(c.content)
                metadata_entries.append({
                    "doc_id": doc_id,
                    "content": c.content,
                    "timestamp_start": getattr(c, 'timestamp_start', None),
                    "timestamp_end": getattr(c, 'timestamp_end', None),
                    "extra_metadata": getattr(c, 'metadata', {}),
                    "deleted": False,
                    "indexed_at": datetime.datetime.utcnow().isoformat(),
                    "model_name": model_name,
                    "model_version": model_version,
                })
            else:
                texts_to_embed.append(c)
                metadata_entries.append({
                    "doc_id": doc_id,
                    "content": c,
                    "deleted": False,
                    "indexed_at": datetime.datetime.utcnow().isoformat(),
                    "model_name": model_name,
                    "model_version": model_version,
                })

        embeddings = embedder.embed_documents(texts_to_embed)
        if not embeddings:
            return

        emb_matrix = np.array(embeddings).astype('float32')

        if self.index is not None and emb_matrix.shape[1] != self.index.d:
            raise ValueError(
                f"Model embedding saat ini menghasilkan dimensi "
                f"{emb_matrix.shape[1]}, tapi index FAISS dibuat dengan "
                f"dimensi {self.index.d}. Kemungkinan Anda mengganti model "
                f"embedding setelah materi sudah di-index. Silakan hapus dan "
                f"upload ulang semua materi setelah ganti model embedding."
            )

        with self._lock:
            if self.index is None:
                self.dimension = emb_matrix.shape[1]
                self.index = faiss.IndexFlatL2(self.dimension)

            start_idx = self.index.ntotal
            self.index.add(emb_matrix)
            end_idx = self.index.ntotal

            self.doc_to_chunk_indices[doc_id] = list(range(start_idx, end_idx))
            self.chunk_metadata.extend(metadata_entries)

            self._dirty = True
            self.save_index()

    # ── Delete Document (O(1) — lazy) ───────────────────────────────

    def delete_document_chunks(self, doc_id: str):
        """Hapus document dari search results tanpa rebuild index.

        O(1): cukup update metadata, tidak sentuh FAISS index.
        """
        with self._lock:
            if doc_id not in self.doc_to_chunk_indices:
                return

            chunk_indices = self.doc_to_chunk_indices.pop(doc_id)

            for idx in chunk_indices:
                if idx < len(self.chunk_metadata):
                    self.chunk_metadata[idx]["deleted"] = True
                    self.chunk_metadata[idx]["deleted_at"] = datetime.datetime.utcnow().isoformat()

            self._deleted_doc_ids.add(doc_id)
            self._dirty = True
            self.save_index()

    # ── Search (skip deleted) ────────────────────────────────────────

    def search(self, query: str, active_doc_ids: list = None, top_k: int = 5) -> str:
        """Search dengan skip deleted documents.

        Args:
            query: Search query text
            active_doc_ids: Jika None, search semua non-deleted docs.
                            Jika list, filter ke docs tersebut.
            top_k: Jumlah hasil maksimal

        Returns:
            String dengan top-k chunks dipisah separator
        """
        with self._lock:
            if self.index is None or self.index.ntotal == 0:
                return ""

            embedder = self._get_embedder()
            query_emb = embedder.embed_query(query)
            q_matrix = np.array([query_emb]).astype('float32')

            if self.index is not None and q_matrix.shape[1] != self.index.d:
                raise ValueError(
                    f"Model embedding saat ini menghasilkan dimensi "
                    f"{q_matrix.shape[1]}, tapi index FAISS dibuat dengan "
                    f"dimensi {self.index.d}. Kemungkinan Anda mengganti model "
                    f"embedding setelah materi sudah di-index. Silakan hapus dan "
                    f"upload ulang semua materi setelah ganti model embedding."
                )

            fetch_k = min(self.index.ntotal, top_k * 3)
            fetch_k = max(1, fetch_k)

            distances, indices = self.index.search(q_matrix, fetch_k)

            results = []
            for idx in indices[0]:
                if idx < 0 or idx >= len(self.chunk_metadata):
                    continue
                meta = self.chunk_metadata[idx]

                if meta.get("deleted", False):
                    continue

                if active_doc_ids and meta["doc_id"] not in active_doc_ids:
                    continue

                content = meta["content"]
                ts_start = meta.get("timestamp_start")

                if ts_start is not None:
                    mins, secs = divmod(ts_start, 60)
                    hours, mins = divmod(mins, 60)
                    ts_str = f"{hours:02d}:{mins:02d}:{secs:02d}" if hours > 0 else f"{mins:02d}:{secs:02d}"
                    content = f"[Timestamp: {ts_str}]\n{content}"

                results.append(content)
                if len(results) >= top_k:
                    break

            return "\n\n---\n\n".join(results)

    # ── Rebuild Index ────────────────────────────────────────────────

    def _should_rebuild(self):
        """Cek apakah perlu rebuild berdasarkan ratio deleted chunks."""
        if not self.chunk_metadata:
            return False
        deleted_count = sum(1 for m in self.chunk_metadata if m.get("deleted", False))
        ratio = deleted_count / len(self.chunk_metadata)
        return ratio >= self._rebuild_threshold

    def rebuild_index(self):
        """Rebuild FAISS index, hanya untuk non-deleted documents.

        O(n) — panggil manual atau via schedule, bukan otomatis saat delete.
        Sets model_name + model_version on all rebuilt chunks.
        """
        with self._lock:
            if not self.chunk_metadata:
                self.index = None
                self.doc_to_chunk_indices = {}
                self._deleted_doc_ids = set()
                self.save_index()
                return

            active_chunks = [m for m in self.chunk_metadata if not m.get("deleted", False)]
            if not active_chunks:
                self.index = None
                self.chunk_metadata = []
                self.doc_to_chunk_indices = {}
                self._deleted_doc_ids = set()
                self.save_index()
                return

            texts = [m["content"] for m in active_chunks]

            embedder = self._get_embedder()
            model_name = self.get_embedding_model_name()
            model_version = self.get_embedding_model_version()

            embeddings = embedder.embed_documents(texts)
            emb_matrix = np.array(embeddings).astype('float32')

            new_index = faiss.IndexFlatL2(emb_matrix.shape[1])
            new_index.add(emb_matrix)

            new_doc_map = {}
            for idx, meta in enumerate(active_chunks):
                doc_id = meta["doc_id"]
                if doc_id not in new_doc_map:
                    new_doc_map[doc_id] = []
                new_doc_map[doc_id].append(idx)
                meta["model_name"] = model_name
                meta["model_version"] = model_version

            self.index = new_index
            self.dimension = emb_matrix.shape[1]
            self.chunk_metadata = active_chunks
            self.doc_to_chunk_indices = new_doc_map
            self._deleted_doc_ids = set()

            self._dirty = True
            self.save_index()

    def get_stats(self):
        """Return statistik index untuk monitoring."""
        with self._lock:
            total = len(self.chunk_metadata)
            deleted = sum(1 for m in self.chunk_metadata if m.get("deleted", False))
            active = total - deleted

            index_models = set()
            for meta in self.chunk_metadata:
                v = meta.get("model_version") or meta.get("model_name") or "unknown"
                index_models.add(v)

            compatibility = self.check_model_compatibility()

            return {
                "total_chunks": total,
                "active_chunks": active,
                "deleted_chunks": deleted,
                "deleted_ratio": round(deleted / total, 3) if total > 0 else 0,
                "total_documents": len(self.doc_to_chunk_indices) + len(self._deleted_doc_ids),
                "active_documents": len(self.doc_to_chunk_indices),
                "deleted_documents": len(self._deleted_doc_ids),
                "needs_rebuild": self._should_rebuild(),
                "embedding_dimension": self.dimension,
                "model": self._cached_model_name,
                "index_model_versions": list(index_models),
                "compatibility": compatibility["status"],
            }


rag_service = RAGService()