import os
import shutil
import uuid
import logging
from fastapi import UploadFile
from sqlalchemy.orm import Session
from app import config
from app.database import SessionLocal
from app.models import MaterialType
from app.repositories.material_repository import material_repository
from app.services.cache_service import cache_service
from app.services.rag_service import rag_service
from app.parsers.document_parser import extract_text

logger = logging.getLogger(__name__)


def chunk_text(text: str) -> list:
    """Pecah teks menjadi chunk dengan overlap, dipakai upload & reindex."""
    paragraphs = text.split("\n\n")
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
    return chunks


class MaterialService:
    EXT_TYPE_MAP = {
        '.pdf': MaterialType.PDF,
        '.docx': MaterialType.DOCX,
        '.txt': MaterialType.TXT,
        '.md': MaterialType.MARKDOWN,
        '.pptx': MaterialType.PPTX,
        '.xlsx': MaterialType.XLSX,
        '.csv': MaterialType.TXT,
    }

    _MAGIC_BYTES = {
        ".pdf": [b"%PDF"],
        ".docx": [b"PK\x03\x04"],  # ZIP header (OOXML)
        ".pptx": [b"PK\x03\x04"],
        ".xlsx": [b"PK\x03\x04"],
        # txt / md / csv: teks plain, tidak ada magic bytes spesifik
    }

    def _validate_magic(self, ext: str, filepath: str):
        magic_list = self._MAGIC_BYTES.get(ext)
        if not magic_list:
            return
        try:
            with open(filepath, "rb") as f:
                head = f.read(2048)
        except OSError:
            raise ValueError("Gagal membaca file yang diunggah.")
        if not any(m in head for m in magic_list):
            try:
                os.remove(filepath)
            except OSError:
                pass
            raise ValueError("File tampaknya rusak atau ekstensinya dipalsukan.")

    def upload_material_sync(self, db: Session, subject_id: int, file: UploadFile) -> str:
        original_filename = file.filename or "uploaded_file"
        ext = os.path.splitext(original_filename)[1].lower()
        safe_filename = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(config.UPLOADS_DIR, safe_filename)

        # Tulis file dengan penghitung byte — file yang melebihi MAX_SIZE
        # dihapus langsung, tanpa pernah buffer penuh di memori.
        MAX_SIZE = 50 * 1024 * 1024
        written = 0
        try:
            with open(filepath, "wb") as buffer:
                while True:
                    chunk = file.file.read(1024 * 1024)
                    if not chunk:
                        break
                    written += len(chunk)
                    if written > MAX_SIZE:
                        raise ValueError(f"Ukuran file melebihi batas 50MB.")
                    buffer.write(chunk)

            # REQ-01: Validasi magic bytes dari file yang SUDAH ditulis ke disk
            # (stream upload hanya dibaca sekali saat menulis di atas). Scan
            # substring di jendela 2KB pertama agar PDF ber-preamble (mis. BOM)
            # dan file ZIP (docx/pptx/xlsx) tetap lolos. Teks tak punya magic.
            self._validate_magic(ext, filepath)

            mat = material_repository.create(db, {
                "subject_id": subject_id,
                "filename": original_filename,
                "filepath": filepath,
                "material_type": self.EXT_TYPE_MAP.get(ext, MaterialType.PDF),
                "status": "Pending"
            })
        except Exception:
            # File yatim tidak boleh tertinggal di uploads saat insert/limit gagal
            try:
                if os.path.isfile(filepath):
                    os.remove(filepath)
            except OSError:
                logger.warning(f"Gagal membersihkan file yatim upload: {filepath}")
            raise

        if ext not in self.EXT_TYPE_MAP:
            logger.warning(
                "Ekstensi file tak dikenal '%s' untuk '%s' — fallback ke PDF.",
                ext, original_filename,
            )

        return filepath, mat.id

    def _set_progress(self, db: Session, material_id: int, progress: int, stage: str):
        mat = material_repository.get(db, material_id)
        if mat:
            material_repository.update(db, mat, {"progress": progress, "stage": stage})
            db.commit()

    def _remove_file(self, filepath: str):
        # D2: pindah ke trash (safety-net) alih-alih hapus permanen
        from app.services.storage_cleanup_service import trash_file
        trash_file(filepath)

    def process_material_async(self, filepath: str, doc_id: str, material_id: int = None):
        db = SessionLocal()
        try:
            self._set_progress(db, material_id, 30, "Mengekstrak teks dari file...")
            text = extract_text(filepath)
            if not text:
                if material_id:
                    mat = material_repository.get(db, material_id)
                    if mat:
                        self._remove_file(mat.filepath)
                        material_repository.update(db, mat, {"status": "Failed", "failure_reason": "Tidak dapat mengekstrak teks dari file.", "filepath": None})
                        db.commit()
                return
                
            chunks = chunk_text(text)

            self._set_progress(db, material_id, 70, "Membuat potongan materi...")

            rag_service.index_document(doc_id, chunks)

            db.expire_all()
            mat = material_repository.get(db, material_id) if material_id else None
            if material_id and (not mat or mat.status != "Processing"):
                # User cancel/trash tepat saat indexing — buang chunk hantu.
                rag_service.delete_document_chunks(doc_id)
                return

            self._set_progress(db, material_id, 90, "Mengindeks ke RAG...")

            if material_id and mat:
                material_repository.update(db, mat, {"status": "Ready", "progress": 100, "stage": "Selesai"})

            cache_service.invalidate_all(db)
            db.commit()
        except Exception as e:
            if material_id:
                try:
                    mat = material_repository.get(db, material_id)
                    if mat:
                        self._remove_file(mat.filepath)
                        material_repository.update(db, mat, {"status": "Failed", "failure_reason": str(e), "filepath": None})
                        db.commit()
                except Exception:
                    pass
        finally:
            db.close()

    def index_material_file(self, db: Session, material) -> bool:
        """(Re)index satu materi yang sudah punya file di disk.

        Dipakai saat restore dari trash. Sebelumnya restore hanya memanggil
        rebuild_index() yang membangun ulang dari metadata in-memory — padahal
        chunk materi yang di-trash sudah dihapus fisik, sehingga materi yang
        dipulihkan tidak pernah kembali ke index RAG.
        """
        if not material or not material.filepath:
            return False
        path = material.filepath
        if not os.path.isabs(path):
            path = os.path.join(config.BASE_DIR, path)
        if not os.path.isfile(path):
            return False
        text = extract_text(path)
        if not text:
            return False
        rag_service.index_document(f"mat_{material.id}", chunk_text(text))
        return True

    def cancel(self, db: Session, id: int) -> bool:
        mat = material_repository.get(db, id)
        if mat and mat.status in ("Pending", "Processing"):
            # Commit DB dulu (sumber kebenaran), hapus file setelahnya.
            # Jika hapus file gagal, file jadi yatim → di-sweep
            # cleanup_orphan_files, tidak meninggalkan record rusak.
            filepath_to_remove = mat.filepath
            material_repository.update(db, mat, {
                "status": "Failed",
                "failure_reason": "Dibatalkan oleh user.",
                "stage": "Dibatalkan",
                "filepath": None,
            })
            db.commit()
            self._remove_file(filepath_to_remove)
            return True
        return False

    def delete(self, db: Session, id: int) -> bool:
        """Soft-delete: pindahkan materi ke sampah (trash) — bisa di-restore.

        Record Materi tetap ada (status 'Trashed'); file fisik dipindah
        ke storage/trash dan pemetaannya dicatat di TrashItem.
        """
        from app.services.trash_service import trash_material
        return trash_material(db, id)

    def get_by_subject(self, db: Session, subject_id: int):
        """Kembalikan SEMUA materi (untuk UI/listing)."""
        return material_repository.get_by_subject(db, subject_id)

    def get_ready_materials(self, db: Session, subject_id: int, material_ids: str = None):
        """Kembalikan hanya materi dengan status Ready, opsional filter by material_ids."""
        all_materials = material_repository.get_by_subject(db, subject_id)
        if material_ids:
            ids = [int(x.strip()) for x in material_ids.split(",") if x.strip()]
            if ids:
                all_materials = [m for m in all_materials if m.id in ids]
        return [m for m in all_materials if m.status == "Ready"]

material_service = MaterialService()
