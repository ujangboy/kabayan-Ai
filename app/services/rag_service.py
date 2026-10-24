import os
import re
import json
import hashlib
import logging
import numpy as np
import lancedb
import threading
import datetime
from app.time_utils import utcnow
import pandas as pd
import pyarrow as pa
from langchain_huggingface import HuggingFaceEmbeddings
from app import config
from app.services.settings_service import settings_service
from app.database import SessionLocal

TABLE_NAME = "chunks"
logger = logging.getLogger(__name__)

# Bobot hybrid scoring (0 token LLM — murni kalkulasi lokal):
#   vector   : kesamaan semantik embedding (jarak L2 → skor 0..1)
#   keyword  : overlap token kata kunci query vs chunk (BM25-lite)
#   position : kedudukan kandidat dalam hasil vector search (tie-break ringan)
VECTOR_WEIGHT = 0.6
KEYWORD_WEIGHT = 0.3
POSITION_WEIGHT = 0.1

_TOKEN_RE = re.compile(r"[^\w\s]", re.UNICODE)

# ── B1: doc_id sanitization ────────────────────────────────────────────────
# doc_id dipakai dalam filter WHERE LanceDB (doc_id IN (...)) dan metadata tabel.
# Batasi ke karakter aman agar tidak bisa menyisipkan injeksi/path traversal.
_DOC_ID_ALLOWED_RE = re.compile(r'[^0-9A-Za-z_-]')


def _sanitize_doc_id(doc_id) -> str:
    s = str(doc_id or "").strip()
    if not s:
        return ""
    return _DOC_ID_ALLOWED_RE.sub('_', s)


# ── Hybrid scoring (0 token LLM) ─────────────────────────────────────────────

def _tokenize(text: str) -> list:
    """Tokenisasi ringan: lowercase, buang tanda baca, token >= 2 karakter."""
    if not text:
        return []
    return [tok for tok in _TOKEN_RE.sub(" ", text.lower()).split() if len(tok) >= 2]


def _keyword_overlap(query_tokens: list, content_tokens: list) -> float:
    """Proporsi token query unik yang muncul di chunk (BM25-lite, 0..1)."""
    if not query_tokens or not content_tokens:
        return 0.0
    qset = set(query_tokens)
    cset = set(content_tokens)
    return len(qset & cset) / len(qset)


def _normalize_vec(distance) -> float:
    """Jarak L2 LanceDB → skor kemiripan 0..1 (distance 0 → 1.0)."""
    if distance is None:
        return 0.0
    try:
        d = float(distance)
    except (TypeError, ValueError):
        return 0.0
    if d < 0:
        return 1.0
    return 1.0 / (1.0 + d)


def _score_candidates(rows: list, query_tokens: list) -> list:
    """Ranking ulang kandidat: hybrid = 0.6*vector + 0.3*keyword + 0.1*posisi.

    rows: daftar dict hasil vector search ({content, _distance, ...}).
    Mengembalikan list (hybrid_score, vec_score, row) terurut menurun
    (tie-break skor vector).
    """
    scored = []
    n = len(rows)
    for i, r in enumerate(rows):
        content = r.get("content", "")
        if not content:
            continue
        vec = _normalize_vec(r.get("_distance"))
        kw = _keyword_overlap(query_tokens, _tokenize(content)) if query_tokens else 0.0
        pos = 1.0 - (i / max(1, n))
        hybrid = VECTOR_WEIGHT * vec + KEYWORD_WEIGHT * kw + POSITION_WEIGHT * pos
        scored.append((hybrid, vec, r))
    scored.sort(key=lambda t: (-t[0], -t[1]))
    return scored


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
        # B8: lazy-load — index tidak dimuat saat import/startup,
        # hanya saat pertama kali benar-benar dipakai.
        self._loaded = False

    def _ensure_loaded(self):
        """Muat index LanceDB secara lazy (B8), thread-safe via RLock."""
        with self._lock:
            if not self._loaded:
                self._load_index()
                self._loaded = True

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
        if self._cached_model_name:
            return self._cached_model_name
        db = SessionLocal()
        try:
            return settings_service.get_embedding_model(db)
        finally:
            db.close()

    def get_embedding_model_version(self) -> str:
        return _embedding_model_version(self.get_embedding_model_name())

    def check_model_compatibility(self) -> dict:
        with self._lock:
            self._ensure_loaded()
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

            except Exception as exc:
                logger.warning("Gagal memuat index LanceDB: %r", exc)
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

        self._ensure_loaded()
        doc_id = _sanitize_doc_id(doc_id)
        if not doc_id:
            raise ValueError("doc_id tidak valid")

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
                    "indexed_at": utcnow().isoformat(),
                    "model_name": model_name,
                    "model_version": model_version,
                })
            else:
                texts_to_embed.append(c)
                metadata_entries.append({
                    "doc_id": doc_id,
                    "content": c,
                    "deleted": False,
                    "indexed_at": utcnow().isoformat(),
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

        # Baru hapus chunk lama SETELAH embedding baru berhasil dibuat dan
        # dimensinya cocok. Sebelumnya delete dilakukan paling awal sehingga
        # kegagalan embedding/model membuat dokumen lama hilang dari index.
        self.delete_document_chunks(doc_id)

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
            self._ensure_loaded()
            doc_id = _sanitize_doc_id(doc_id)
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
                    meta["deleted_at"] = utcnow().isoformat()

            self._deleted_doc_ids.add(doc_id)
            self._dirty = True

    # ── Search ───────────────────────────────────────────────────────

    def search(self, query: str, active_doc_ids: list = None, top_k: int = 5) -> dict:
        with self._lock:
            self._ensure_loaded()
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
                ids_str = ", ".join(f"'{_sanitize_doc_id(d)}'" for d in active_doc_ids if _sanitize_doc_id(d))
                if ids_str:
                    filters.append(f"doc_id IN ({ids_str})")
            where_clause = " AND ".join(filters)

            fetch_k = max(1, top_k * 6)

            try:
                results = self._table.search(query_vec).where(where_clause).limit(fetch_k).to_list()
            except Exception as exc:
                logger.warning("Pencarian RAG gagal: %r", exc)
                return {"text": "", "sources": []}

            out = []
            sources = []
            for _, _, r in _score_candidates(results, _tokenize(query)):
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
            self._ensure_loaded()
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
                    "indexed_at": meta.get("indexed_at", utcnow().isoformat()),
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
            self._ensure_loaded()
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
