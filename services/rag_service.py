import os
import json
import hashlib
import numpy as np
import lancedb
import threading
import datetime
import pandas as pd
import pyarrow as pa
from langchain_huggingface import HuggingFaceEmbeddings
import config
from services.settings_service import settings_service
from database import SessionLocal

TABLE_NAME = "chunks"


def _table_schema(dim: int) -> pa.Schema:
    """Skema eksplisit tabel LanceDB.

    Penting: timestamp_start/end bertipe int64 NULLABLE (bukan null/infer),
    agar chunk dokumen (tanpa timestamp) dan chunk YouTube (ber-timestamp)
    bisa hidup dalam tabel yang sama.
    """
    return pa.schema([
        pa.field("id", pa.int64(), nullable=False),
        pa.field("vector", pa.list_(pa.float32(), dim), nullable=False),
        pa.field("doc_id", pa.string(), nullable=False),
        pa.field("content", pa.string(), nullable=False),
        pa.field("deleted", pa.bool_(), nullable=False),
        pa.field("timestamp_start", pa.int64(), nullable=True),
        pa.field("timestamp_end", pa.int64(), nullable=True),
        pa.field("model_name", pa.string(), nullable=True),
        pa.field("model_version", pa.string(), nullable=True),
        pa.field("indexed_at", pa.string(), nullable=False),
        pa.field("extra_metadata", pa.string(), nullable=True),
    ])


def _embedding_model_version(model_name: str) -> str:
    h = hashlib.md5(model_name.encode()).hexdigest()[:8]
    return f"{model_name.replace('/', '_')}-{h}"


def _is_deleted(meta: dict) -> bool:
    return meta.get("deleted", False)


def _nan_to_none(val):
    if val is None:
        return None
    try:
        return None if pd.isna(val) else val
    except Exception:
        return val


class RAGService:
    """RAG Service dengan LanceDB sebagai vector store persisten.

    Key features:
    - LanceDB persistent storage (no in-memory vector index)
    - Lazy deletion (metadata flag, no rebuild needed)
    - rebuild_index() untuk kompaksi manual
    - Search skip deleted documents via WHERE clause
    - Model versioning per chunk
    - Thread-safe operations
    - 0 token LLM untuk indexing (hanya embedding)
    """

    def __init__(self):
        self.dimension = 384
        self.chunk_metadata = []
        self.doc_to_chunk_indices = {}
        self._deleted_doc_ids = set()
        self._rebuild_threshold = 0.3
        self._dirty = False
        self._cached_embedder = None
        self._cached_model_name = None
        self._lock = threading.RLock()
        self._db = None
        self._table = None
        self._query_embed_cache = {}
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
        return self._cached_model_name or settings_service.get_embedding_model(SessionLocal())

    def get_embedding_model_version(self) -> str:
        return _embedding_model_version(self.get_embedding_model_name())

    def check_model_compatibility(self) -> dict:
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

    # ── Persistence (LanceDB) ────────────────────────────────────────

    def _load_index(self):
        with self._lock:
            self._db = lancedb.connect(config.LANCEDB_DIR)
            try:
                self._table = self._db.open_table(TABLE_NAME)
                df = self._table.to_pandas()
                if df.empty:
                    self.chunk_metadata = []
                    self.doc_to_chunk_indices = {}
                    return

                self.chunk_metadata = []
                self.doc_to_chunk_indices = {}

                for _, row in df.iterrows():
                    meta = {
                        "id": int(row["id"]),
                        "doc_id": str(row["doc_id"]),
                        "content": str(row["content"]),
                        "deleted": bool(row["deleted"]),
                        "timestamp_start": _nan_to_none(row.get("timestamp_start")),
                        "timestamp_end": _nan_to_none(row.get("timestamp_end")),
                        "model_name": str(row.get("model_name", "") or ""),
                        "model_version": str(row.get("model_version", "") or ""),
                        "indexed_at": str(row.get("indexed_at", "") or ""),
                        "extra_metadata": _nan_to_none(row.get("extra_metadata")),
                    }
                    self.chunk_metadata.append(meta)

                    doc_id = meta["doc_id"]
                    if doc_id not in self.doc_to_chunk_indices:
                        self.doc_to_chunk_indices[doc_id] = []
                    self.doc_to_chunk_indices[doc_id].append(meta["id"])
                    if meta["deleted"]:
                        self._deleted_doc_ids.add(doc_id)

                vec_col = df.iloc[0]["vector"]
                if hasattr(vec_col, "__len__"):
                    self.dimension = len(vec_col)

            except Exception:
                self._table = None
                self.chunk_metadata = []
                self.doc_to_chunk_indices = {}

    def _next_id(self) -> int:
        if not self.chunk_metadata:
            return 0
        return max(m["id"] for m in self.chunk_metadata) + 1

    # ── Index Document ───────────────────────────────────────────────

    def index_document(self, doc_id: str, chunks: list):
        if not chunks:
            return

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

        if emb_matrix.shape[1] != self.dimension and self.chunk_metadata:
            raise ValueError(
                f"Model embedding saat ini menghasilkan dimensi "
                f"{emb_matrix.shape[1]}, tapi index dibuat dengan "
                f"dimensi {self.dimension}. Kemungkinan Anda mengganti model "
                f"embedding setelah materi sudah di-index. Silakan hapus dan "
                f"upload ulang semua materi setelah ganti model embedding."
            )

        with self._lock:
            self.dimension = emb_matrix.shape[1]
            records = []
            ids = []
            for i, (emb, meta) in enumerate(zip(emb_matrix, metadata_entries)):
                row_id = self._next_id() + i
                extra = meta.get("extra_metadata", {})
                records.append({
                    "id": row_id,
                    "vector": emb,
                    "doc_id": meta["doc_id"],
                    "content": meta["content"],
                    "deleted": False,
                    "timestamp_start": meta.get("timestamp_start"),
                    "timestamp_end": meta.get("timestamp_end"),
                    "model_name": model_name,
                    "model_version": model_version,
                    "indexed_at": meta["indexed_at"],
                    "extra_metadata": json.dumps(extra, ensure_ascii=False) if extra else None,
                })
                ids.append(row_id)

            if self._table is None:
                self._table = self._db.create_table(TABLE_NAME, records, mode="overwrite", schema=_table_schema(self.dimension))
            else:
                self._table.add(records)

            self.doc_to_chunk_indices[doc_id] = ids
            for meta, rid in zip(metadata_entries, ids):
                meta["id"] = rid
                self.chunk_metadata.append(meta)

            self._dirty = True

    # ── Delete (lazy) ────────────────────────────────────────────────

    def delete_document_chunks(self, doc_id: str):
        with self._lock:
            if doc_id not in self.doc_to_chunk_indices:
                return

            ids = self.doc_to_chunk_indices.pop(doc_id)
            if self._table is not None:
                ids_str = ", ".join(str(i) for i in ids)
                # Physical delete in LanceDB
                try:
                    self._table.delete(f"id IN ({ids_str})")
                    self._table.compact_files()
                    self._table.cleanup_old_versions()
                except Exception as e:
                    import logging
                    logging.warning(f"LanceDB delete/compact failed: {e}")

            for meta in self.chunk_metadata:
                if meta["doc_id"] == doc_id:
                    meta["deleted"] = True
                    meta["deleted_at"] = datetime.datetime.utcnow().isoformat()

            self._deleted_doc_ids.add(doc_id)
            self._dirty = True

    # ── Search ───────────────────────────────────────────────────────

    def search(self, query: str, active_doc_ids: list = None, top_k: int = 5) -> dict:
        with self._lock:
            if self._table is None or not self.chunk_metadata:
                return {"text": "", "sources": []}

            embedder = self._get_embedder()
            if query in self._query_embed_cache:
                query_vec = self._query_embed_cache[query]
            else:
                query_vec = np.array(embedder.embed_query(query)).astype('float32')
                if len(self._query_embed_cache) > 100:
                    self._query_embed_cache.clear()
                self._query_embed_cache[query] = query_vec

            filters = ["deleted = false"]
            if active_doc_ids:
                ids_str = ", ".join(f"'{d}'" for d in active_doc_ids)
                filters.append(f"doc_id IN ({ids_str})")
            where_clause = " AND ".join(filters)

            fetch_k = max(1, top_k * 3)

            try:
                results = self._table.search(query_vec).where(where_clause).limit(fetch_k).to_list()
            except Exception:
                return {"text": "", "sources": []}

            out = []
            sources = []
            for r in results:
                ts_start = _nan_to_none(r.get("timestamp_start"))
                content = r.get("content", "")
                doc_id = str(r.get("doc_id", ""))
                if not content:
                    continue

                if ts_start is not None:
                    mins, secs = divmod(int(ts_start), 60)
                    hours, mins_rem = divmod(mins, 60)
                    ts_str = f"{hours:02d}:{mins_rem:02d}:{secs:02d}" if hours > 0 else f"{mins:02d}:{secs:02d}"
                    content = f"[{ts_str}] {content}"

                out.append(f"[Sumber: {doc_id}] {content}")
                sources.append({"doc_id": doc_id, "content": content[:200]})
                if len(out) >= top_k:
                    break

            text = "\n\n---\n\n".join(out)
            return {"text": text, "sources": sources}

    # ── Rebuild Index ────────────────────────────────────────────────

    def _should_rebuild(self):
        if not self.chunk_metadata:
            return False
        deleted_count = sum(1 for m in self.chunk_metadata if _is_deleted(m))
        ratio = deleted_count / len(self.chunk_metadata)
        return ratio >= self._rebuild_threshold

    def rebuild_index(self):
        with self._lock:
            if not self.chunk_metadata:
                self.chunk_metadata = []
                self.doc_to_chunk_indices = {}
                self._deleted_doc_ids = set()
                try:
                    self._db.drop_table(TABLE_NAME)
                except Exception:
                    pass
                self._table = None
                return

            active_chunks = [m for m in self.chunk_metadata if not _is_deleted(m)]
            if not active_chunks:
                self.chunk_metadata = []
                self.doc_to_chunk_indices = {}
                self._deleted_doc_ids = set()
                try:
                    self._db.drop_table(TABLE_NAME)
                except Exception:
                    pass
                self._table = None
                return

            texts = [m["content"] for m in active_chunks]
            embedder = self._get_embedder()
            model_name = self.get_embedding_model_name()
            model_version = self.get_embedding_model_version()

            embeddings = embedder.embed_documents(texts)
            emb_matrix = np.array(embeddings).astype('float32')

            records = []
            new_metadata = []
            new_doc_map = {}
            for idx, (meta, emb) in enumerate(zip(active_chunks, emb_matrix)):
                meta["id"] = idx
                meta["model_name"] = model_name
                meta["model_version"] = model_version
                doc_id = meta["doc_id"]

                if doc_id not in new_doc_map:
                    new_doc_map[doc_id] = []
                new_doc_map[doc_id].append(idx)

                extra = meta.get("extra_metadata", {})
                records.append({
                    "id": idx,
                    "vector": emb,
                    "doc_id": doc_id,
                    "content": meta["content"],
                    "deleted": False,
                    "timestamp_start": meta.get("timestamp_start"),
                    "timestamp_end": meta.get("timestamp_end"),
                    "model_name": model_name,
                    "model_version": model_version,
                    "indexed_at": meta.get("indexed_at", datetime.datetime.utcnow().isoformat()),
                    "extra_metadata": json.dumps(extra, ensure_ascii=False) if extra else None,
                })
                new_metadata.append(meta)

            try:
                self._db.drop_table(TABLE_NAME)
            except Exception:
                pass
            self._table = self._db.create_table(TABLE_NAME, records, mode="overwrite", schema=_table_schema(self.dimension))

            self.chunk_metadata = new_metadata
            self.doc_to_chunk_indices = new_doc_map
            self._deleted_doc_ids = set()
            self.dimension = emb_matrix.shape[1]
            self._dirty = True

    # ── Stats ────────────────────────────────────────────────────────

    def get_stats(self):
        with self._lock:
            total = len(self.chunk_metadata)
            deleted = sum(1 for m in self.chunk_metadata if _is_deleted(m))
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
                "storage_engine": "lancedb",
            }


rag_service = RAGService()
