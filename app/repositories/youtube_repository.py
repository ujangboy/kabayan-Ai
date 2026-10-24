from sqlalchemy.orm import Session
from app.models import YoutubeMetadata

class YoutubeRepository:
    @staticmethod
    def create(db: Session, data: dict) -> YoutubeMetadata:
        metadata = YoutubeMetadata(**data)
        db.add(metadata)
        db.commit()
        db.refresh(metadata)
        return metadata
        
    @staticmethod
    def get_by_video_id(db: Session, video_id: str) -> YoutubeMetadata:
        return db.query(YoutubeMetadata).filter(YoutubeMetadata.video_id == video_id).first()
        
    @staticmethod
    def get_by_material_id(db: Session, material_id: int) -> YoutubeMetadata:
        return db.query(YoutubeMetadata).filter(YoutubeMetadata.material_id == material_id).first()

    @staticmethod
    def delete(db: Session, id: int) -> bool:
        metadata = db.query(YoutubeMetadata).filter(YoutubeMetadata.id == id).first()
        if metadata:
            db.delete(metadata)
            db.commit()
            return True
        return False

youtube_repository = YoutubeRepository()
