import time
from sqlalchemy.orm import Session
from typing import TypeVar, Generic, Type, List, Optional
from database import Base
from sqlalchemy.exc import OperationalError

ModelType = TypeVar("ModelType", bound=Base)

class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    def get(self, db: Session, id: int) -> Optional[ModelType]:
        return db.query(self.model).filter(self.model.id == id).first()

    def get_all(self, db: Session, skip: int = 0, limit: Optional[int] = None) -> List[ModelType]:
        q = db.query(self.model).offset(skip)
        if limit is not None:
            q = q.limit(limit)
        return q.all()

    def create(self, db: Session, obj_in: dict) -> ModelType:
        obj_data = obj_in
        db_obj = self.model(**obj_data)
        db.add(db_obj)
        db.flush()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: ModelType, obj_in: dict) -> ModelType:
        for field in obj_in:
            if hasattr(db_obj, field):
                setattr(db_obj, field, obj_in[field])
        db.flush()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, id: int) -> bool:
        retries = 3
        for attempt in range(retries):
            try:
                obj = db.query(self.model).filter(self.model.id == id).first()
                if obj:
                    db.delete(obj)
                    db.flush()
                    return True
                return False
            except OperationalError:
                if attempt < retries - 1:
                    db.rollback()
                    time.sleep(0.1 * (2 ** attempt))
                    continue
                raise

    def delete_all(self, db: Session) -> bool:
        retries = 3
        for attempt in range(retries):
            try:
                db.query(self.model).delete()
                db.flush()
                return True
            except OperationalError:
                if attempt < retries - 1:
                    db.rollback()
                    time.sleep(0.1 * (2 ** attempt))
                    continue
                raise
            except Exception:
                return False

