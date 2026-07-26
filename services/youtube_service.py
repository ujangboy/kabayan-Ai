from sqlalchemy.orm import Session
from models import Material, MaterialType
from repositories.material_repository import material_repository
from repositories.youtube_repository import youtube_repository
from sources.youtube_source import YoutubeSource
from services.rag_service import rag_service
from services.cache_service import cache_service
from database import SessionLocal
import os
import config

class YoutubeService:
    @staticmethod
    def process_youtube_async(material_id: int, url: str):
        db = SessionLocal()
        try:
            # Get material
            mat = material_repository.get(db, material_id)
            if not mat:
                db.close()
                return

            mat.status = "Processing"
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
            
            # Extract transcript and chunks
            chunks = source.extract()
            
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

            # Index into RAG (FAISS)
            doc_id = f"mat_{mat.id}"
            rag_service.index_document(doc_id, chunks)

            # Update status
            mat.status = "Ready"
            db.commit()

            # Invalidate cache
            cache_service.invalidate_all(db)

        except Exception as e:
            print(f"Error processing youtube: {e}")
            mat = material_repository.get(db, material_id)
            if mat:
                mat.status = "Failed"
                db.commit()
        finally:
            db.close()

    @staticmethod
    def delete_youtube(db: Session, material_id: int) -> bool:
        mat = material_repository.get(db, material_id)
        if mat and mat.material_type == MaterialType.YOUTUBE:
            doc_id = f"mat_{mat.id}"
            rag_service.delete_document_chunks(doc_id)
            
            # cascade will handle youtube_metadata
            success = material_repository.delete(db, material_id)
            if success:
                cache_service.invalidate_all(db)
            return success
        return False

youtube_service = YoutubeService()
