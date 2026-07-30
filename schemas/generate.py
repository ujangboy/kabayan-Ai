from pydantic import BaseModel
from typing import Optional

class GenerateQuizRequest(BaseModel):
    subject_id: int
    mcq_count: int = 5
    material_ids: Optional[str] = None

class GenerateFlashcardRequest(BaseModel):
    subject_id: int
    count: int = 10
    material_ids: Optional[str] = None

class GenerateNoteRequest(BaseModel):
    subject_id: int
    title: Optional[str] = None
    material_ids: Optional[str] = None
