from pydantic import BaseModel, Field
from typing import Optional

class ChatMessage(BaseModel):
    role: str = "unknown"
    content: str = ""

class DetectContextRequest(BaseModel):
    history: list[ChatMessage] = Field(default_factory=list)

class GenerateTitleRequest(BaseModel):
    content: str = ""

class GenerateQuizRequest(BaseModel):
    subject_id: int
    mcq_count: int = Field(default=5, ge=1, le=30)
    essay_count: int = Field(default=0, ge=0, le=10)
    material_ids: Optional[str] = None
    difficulty: Optional[str] = "sedang"  # mudah / sedang / sulit

class GenerateFlashcardRequest(BaseModel):
    subject_id: int
    count: int = Field(default=10, ge=5, le=20)
    material_ids: Optional[str] = None
    # batch_id dihapus — service selalu generate batch_id baru agar setiap generate = deck terpisah

class GenerateNoteRequest(BaseModel):
    subject_id: int
    title: Optional[str] = None
    material_ids: Optional[str] = None
