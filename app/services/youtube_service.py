import logging
from sqlalchemy.orm import Session
from app.models import Material, MaterialType
from app.repositories.material_repository import material_repository
from app.repositories.youtube_repository import youtube_repository
from app.sources.youtube_source import YoutubeSource
from app.services.rag_service import rag_service
from app.services.cache_service import cache_service
from app.database import SessionLocal
from app.exceptions import AppError
import os
from app import config

logger = logging.getLogger(__name__)

class YoutubeService:
    def process_youtube_async(self, material_id: int, url: str):
        db = SessionLocal()
        try:
            # Get material
            mat = material_repository.get(db, material_id)
            if not mat:
                db.close()
                return

            mat.status = "Processing"
            mat.progress = 10
            mat.stage = "Mendapatkan metadata video..."
            db.commit()

            # Extract source
            source = YoutubeSource(url)
            
            # Save metadata
            meta = source.get_metadata()
            youtube_repository.create(db, {
                "material_id": mat.id,
                "video_id": source.video_id,
                "title": meta.get("title", ""),
                "channel_name": meta.get("channel_name", ""),
                "thumbnail_url": meta.get("thumbnail_url", ""),
                "video_url": url,
                "transcript_language": "id" # default, will update
            })
            db.commit()
            
            # Extract transcript and chunks (callback update progress per jalur)
            def _on_progress(stage: str, progress: int):
                mat = material_repository.get(db, material_id)
                if mat:
                    mat.stage = stage
                    mat.progress = progress
                    db.commit()
            chunks = source.extract(progress_cb=_on_progress)

            # Batas durasi maksimum: video sangat panjang (mis. live/stream panjang)
            # membebani transkrip & RAG. 20 menit s.d. 3 jam didukung penuh.
            MAX_DURATION_SEC = 3 * 3600
            if chunks and chunks[-1].timestamp_end and chunks[-1].timestamp_end > MAX_DURATION_SEC:
                minutes = chunks[-1].timestamp_end / 60
                raise AppError(
                    f"Durasi video terlalu panjang ({minutes:.0f} menit). "
                    "Maksimal 180 menit (3 jam)."
                )

            mat = material_repository.get(db, material_id)
            if mat:
                mat.progress = 80
                mat.stage = "Menyimpan transkrip..."
                db.commit()
            
            # If valid, save language and duration
            if chunks:
                first_meta = chunks[0].metadata
                lang = first_meta.get("language", "id")
                # update metadata record
                y_meta = youtube_repository.get_by_material_id(db, mat.id)
                if y_meta:
                    y_meta.transcript_language = lang
                    # get duration from last chunk end
                    if chunks[-1].timestamp_end:
                        y_meta.duration = chunks[-1].timestamp_end
                    db.commit()

            # Simpan transkrip sebagai .txt agar fallback parser di Chat bisa membacanya
            os.makedirs(config.UPLOADS_DIR, exist_ok=True)
            transcript_path = os.path.join(config.UPLOADS_DIR, f"youtube_{mat.id}_{source.video_id}.txt")
            full_text = "\n\n".join(c.content for c in chunks) if chunks else ""
            if full_text:
                with open(transcript_path, "w", encoding="utf-8") as f:
                    f.write(full_text)
                mat.filepath = transcript_path
                db.commit()

            # Index into RAG (LanceDB)
            doc_id = f"mat_{mat.id}"
            rag_service.index_document(doc_id, chunks)

            # Update status — hanya jika masih "Processing" (batal jika user cancel)
            db.expire_all()
            mat = material_repository.get(db, material_id)
            if not mat or mat.status != "Processing":
                # Cancel/trash tepat saat indexing — buang chunk hantu.
                rag_service.delete_document_chunks(doc_id)
                return

            mat.status = "Ready"
            mat.progress = 100
            mat.stage = "Selesai"
            db.commit()

            # Invalidate cache
            cache_service.invalidate_all(db)

        except Exception as e:
            logger.error(f"Error processing YouTube material {material_id}: {e}", exc_info=True)
            mat = material_repository.get(db, material_id)
            if mat:
                mat.status = "Failed"
                mat.failure_reason = self._user_friendly_error(e)
                db.commit()
        finally:
            db.close()

    def delete_youtube(self, db: Session, material_id: int) -> bool:
        mat = material_repository.get(db, material_id)
        if mat and mat.material_type == MaterialType.YOUTUBE:
            doc_id = f"mat_{mat.id}"
            rag_service.delete_document_chunks(doc_id)
            
            # D2: pindahkan file transkrip ke trash sebelum row dihapus
            from app.services.storage_cleanup_service import trash_file
            trash_file(mat.filepath)

            # cascade will handle youtube_metadata
            success = material_repository.delete(db, material_id)
            if success:
                cache_service.invalidate_all(db)
            return success
        return False

    def _user_friendly_error(self, exc: Exception) -> str:
        err_str = str(exc).lower()
        if "terlalu panjang" in err_str:
            return "Gagal: Durasi video terlalu panjang. Maksimal 180 menit (3 jam)."
        if "invalid youtube url" in err_str:
            return "Gagal: URL YouTube tidak valid."
        if "private" in err_str or "not available" in err_str:
            return "Gagal: Video bersifat privat atau tidak tersedia."
        if "transcript" in err_str and "not found" in err_str:
            return "Gagal: Video tidak memiliki caption/transkrip."
        if "whisper" in err_str or "groq" in err_str:
            return "Gagal: Transkrip tidak ditemukan dan fallback Whisper gagal."
        if "rate limit" in err_str or "429" in err_str:
            return "Gagal: Batas permintaan API terlampaui. Coba lagi nanti."
        if "timeout" in err_str or "timed out" in err_str:
            return "Gagal: Waktu permintaan habis. Coba lagi nanti."
        if "copyright" in err_str or "blocked" in err_str:
            return "Gagal: Video diblokir atau memiliki hak cipta."
        # Fallback: jangan simpan potongan exception mentah ke DB (bisa
        # berisi path/URL internal) — cukup pesan generik, detail di log.
        logger.warning("YouTube processing error (unmapped): %r", exc)
        return "Gagal: Video tidak dapat diproses. Coba lagi nanti."

youtube_service = YoutubeService()
