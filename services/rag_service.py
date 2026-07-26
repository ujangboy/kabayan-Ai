import os
import json
import numpy as np
import faiss
from langchain_huggingface import HuggingFaceEmbeddings
import config
from services.settings_service import settings_service
from database import SessionLocal

class RAGService:
    def __init__(self):
        self.dimension = 384
        self.chunk_metadata = []
        self.index = None
        self.index_path = os.path.join(config.FAISS_INDEX_DIR, "main.index")
        self.metadata_path = os.path.join(config.FAISS_INDEX_DIR, "metadata.json")
        self._cached_embedder = None
        self._cached_model_name = None
        self._load_index()

    def _get_embedder(self):
        db = SessionLocal()
        model_name = settings_service.get_embedding_model(db)
        db.close()
        
        if self._cached_embedder is None or self._cached_model_name != model_name:
            self._cached_embedder = HuggingFaceEmbeddings(model_name=model_name)
            self._cached_model_name = model_name
            
        return self._cached_embedder

    def _load_index(self):
        if os.path.exists(self.index_path):
            self.index = faiss.read_index(self.index_path)
            with open(self.metadata_path, 'r', encoding='utf-8') as f:
                self.chunk_metadata = json.load(f)
            self.dimension = self.index.d
        else:
            self.index = None
            self.chunk_metadata = []

    def save_index(self):
        os.makedirs(config.FAISS_INDEX_DIR, exist_ok=True)
        if self.index is not None:
            faiss.write_index(self.index, self.index_path)
        with open(self.metadata_path, 'w', encoding='utf-8') as f:
            json.dump(self.chunk_metadata, f, ensure_ascii=False)

    def index_document(self, doc_id: str, chunks: list):
        if not chunks:
            return
            
        embedder = self._get_embedder()
        
        texts_to_embed = []
        for c in chunks:
            if hasattr(c, 'content'):
                texts_to_embed.append(c.content)
            else:
                texts_to_embed.append(c)
                
        embeddings = embedder.embed_documents(texts_to_embed)
        
        if not embeddings:
            return

        emb_matrix = np.array(embeddings).astype('float32')
        
        if self.index is None:
            self.dimension = emb_matrix.shape[1]
            self.index = faiss.IndexFlatL2(self.dimension)
            
        self.index.add(emb_matrix)
        
        for chunk in chunks:
            # Check if chunk is a Document object
            if hasattr(chunk, 'content'):
                self.chunk_metadata.append({
                    "doc_id": doc_id,
                    "content": chunk.content,
                    "timestamp_start": getattr(chunk, 'timestamp_start', None),
                    "timestamp_end": getattr(chunk, 'timestamp_end', None),
                    "extra_metadata": getattr(chunk, 'metadata', {})
                })
            else:
                self.chunk_metadata.append({
                    "doc_id": doc_id,
                    "content": chunk
                })
            
        self.save_index()

    def search(self, query: str, active_doc_ids: list = None, top_k: int = 5) -> str:
        if self.index is None or self.index.ntotal == 0:
            return ""
            
        embedder = self._get_embedder()
        query_emb = embedder.embed_query(query)
        q_matrix = np.array([query_emb]).astype('float32')
        
        fetch_k = self.index.ntotal if active_doc_ids else min(self.index.ntotal, top_k)
        fetch_k = max(1, fetch_k)
        
        distances, indices = self.index.search(q_matrix, fetch_k)
        
        results = []
        for idx in indices[0]:
            if idx < 0 or idx >= len(self.chunk_metadata):
                continue
            meta = self.chunk_metadata[idx]
            if active_doc_ids and meta["doc_id"] not in active_doc_ids:
                continue
                
            content = meta["content"]
            ts_start = meta.get("timestamp_start")
            
            if ts_start is not None:
                # format timestamp to mm:ss or hh:mm:ss
                mins, secs = divmod(ts_start, 60)
                hours, mins = divmod(mins, 60)
                ts_str = f"{hours:02d}:{mins:02d}:{secs:02d}" if hours > 0 else f"{mins:02d}:{secs:02d}"
                content = f"[Timestamp: {ts_str}]\n{content}"
                
            results.append(content)
            if len(results) >= top_k:
                break
                
        return "\n\n---\n\n".join(results)

    def delete_document_chunks(self, doc_id: str):
        # FAISS doesn't support direct deletion easily without IDMap.
        # Simple approach for now: rebuild index or filter out.
        # Since we use IndexFlatL2, we'll rebuild it if needed.
        new_metadata = []
        new_texts = []
        for meta in self.chunk_metadata:
            if meta["doc_id"] != doc_id:
                new_metadata.append(meta)
                new_texts.append(meta["content"])
                
        self.chunk_metadata = []
        self.index = None
        if new_texts:
            self.index_document("dummy_rebuild", new_texts) # Need a better rebuild approach, but this works for MVP
            # Fix metadata
            self.chunk_metadata = new_metadata
            self.save_index()
        else:
            self.save_index()

rag_service = RAGService()
