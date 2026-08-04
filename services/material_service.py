import os
import shutil
import uuid
from fastapi import UploadFile
from sqlalchemy.orm import Session
import config
from database import SessionLocal
from repositories.material_repository import material_repository
from services.cache_service import cache_service
from services.rag_service import rag_service
from parsers.document_parser import extract_text

class MaterialService:
    @staticmethod
    def upload_material_sync(db: Session, subject_id: int, file: UploadFile) -> str:
        original_filename = file.filename or "uploaded_file"
        ext = os.path.splitext(original_filename)[1]
        safe_filename = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(config.UPLOADS_DIR, safe_filename)
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        mat = material_repository.create(db, {
            "subject_id": subject_id,
            "filename": original_filename,
            "filepath": filepath,
            "status": "Pending"
        })
        
        return filepath, mat.id

    @staticmethod
    def _set_progress(db: Session, material_id: int, progress: int, stage: str):
        mat = material_repository.get(db, material_id)
        if mat:
            material_repository.update(db, mat, {"progress": progress, "stage": stage})
            db.commit()

    @staticmethod
    def process_material_async(filepath: str, doc_id: str, material_id: int = None):
        db = SessionLocal()
        try:
            MaterialService._set_progress(db, material_id, 30, "Mengekstrak teks dari file...")
            text = extract_text(filepath)
            if not text:
                if material_id:
                    material_repository.update(db, material_repository.get(db, material_id), {"status": "Failed", "failure_reason": "Tidak dapat mengekstrak teks dari file."})
                    db.commit()
                return
                
            paragraphs = text.split('\n\n')
            chunks = []
            current_chunk = []
            current_word_count = 0
            target_words = config.CHUNK_SIZE
            overlap_words = config.CHUNK_OVERLAP

            for para in paragraphs:
                para = para.strip()
                if not para:
                    continue
                word_count = len(para.split())
                if current_word_count + word_count > target_words and current_chunk:
                    chunks.append("\n\n".join(current_chunk))
                    # Overlap: keep last `overlap_words` words for next chunk
                    overlap_text = " ".join(current_chunk).split()
                    if overlap_words > 0 and len(overlap_text) > overlap_words:
                        current_chunk = [" ".join(overlap_text[-overlap_words:]) + " " + para]
                        current_word_count = overlap_words + word_count
                    else:
                        current_chunk = [para]
                        current_word_count = word_count
                else:
                    current_chunk.append(para)
                    current_word_count += word_count
                    
            if current_chunk:
                chunks.append("\n\n".join(current_chunk))

            MaterialService._set_progress(db, material_id, 70, "Membuat potongan materi...")

            rag_service.index_document(doc_id, chunks)

            MaterialService._set_progress(db, material_id, 90, "Mengindeks ke RAG...")

            if material_id:
                mat = material_repository.get(db, material_id)
                if mat and mat.status == "Processing":
                    material_repository.update(db, mat, {"status": "Ready", "progress": 100, "stage": "Selesai"})

            cache_service.invalidate_all(db)
            db.commit()
        except Exception as e:
            if material_id:
                try:
                    material_repository.update(db, material_repository.get(db, material_id), {"status": "Failed", "failure_reason": str(e)})
                    db.commit()
                except Exception:
                    pass
        finally:
            db.close()

    @staticmethod
    def cancel(db: Session, id: int) -> bool:
        mat = material_repository.get(db, id)
        if mat and mat.status in ("Pending", "Processing"):
            material_repository.update(db, mat, {
                "status": "Failed",
                "failure_reason": "Dibatalkan oleh user.",
                "stage": "Dibatalkan",
            })
            db.commit()
            return True
        return False

    @staticmethod
    def delete(db: Session, id: int) -> bool:
        mat = material_repository.get(db, id)
        if mat:
            doc_id = f"mat_{mat.id}"
            rag_service.delete_document_chunks(doc_id)
            if rag_service._should_rebuild():
                import threading
                threading.Thread(target=rag_service.rebuild_index, daemon=True).start()
            if os.path.exists(mat.filepath):
                try:
                    os.remove(mat.filepath)
                except:
                    pass
            success = material_repository.delete(db, id)
            if success:
                cache_service.invalidate_all(db)
            return success
        return False

    @staticmethod
    def get_by_subject(db: Session, subject_id: int):
        """Kembalikan SEMUA materi (untuk UI/listing)."""
        return material_repository.get_by_subject(db, subject_id)

    @staticmethod
    def get_ready_materials(db: Session, subject_id: int, material_ids: str = None):
        """Kembalikan hanya materi dengan status Ready, opsional filter by material_ids."""
        all_materials = material_repository.get_by_subject(db, subject_id)
        if material_ids:
            ids = [int(x.strip()) for x in material_ids.split(",") if x.strip()]
            if ids:
                all_materials = [m for m in all_materials if m.id in ids]
        return [m for m in all_materials if m.status == "Ready"]

material_service = MaterialService()
