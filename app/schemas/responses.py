"""Skema respons presisi untuk endpoint GET utama (R1 lanjutan).

Handler mengembalikan JSONResponse, sehingga response_model hanya memengaruhi
dokumentasi OpenAPI (tidak mengubah serialisasi runtime). Skema di bawah
menangkap bentuk *envelope* utama; field dinamis di dalamnya ditoleransi
melalui tipe Dict[str, Any] agar dokumentasi akurat tanpa harus mencerminkan
setiap kolom bersarang yang bergantung pada agregasi backend.
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict


class SubjectList(BaseModel):
    subjects: List[Dict[str, Any]]


class SubjectDetail(BaseModel):
    subject: Dict[str, Any]


class MaterialList(BaseModel):
    materials: List[Dict[str, Any]]
    skip: int
    limit: int


class NoteList(BaseModel):
    notes: List[Dict[str, Any]]
    skip: int
    limit: int


class FlashcardList(BaseModel):
    flashcards: List[Dict[str, Any]]
    skip: int
    limit: int


class FlashcardDue(BaseModel):
    due_count: int
    flashcards: List[Dict[str, Any]]


class FlashcardReviews(BaseModel):
    reviews: Dict[str, Any]


class FlashcardStats(BaseModel):
    model_config = ConfigDict(extra="allow")
    subject_id: Optional[int] = None


class QuizList(BaseModel):
    model_config = ConfigDict(extra="allow")


class DashboardStats(BaseModel):
    model_config = ConfigDict(extra="allow")


class ProfileResponse(BaseModel):
    model_config = ConfigDict(extra="allow")


class InfoResponse(BaseModel):
    model_config = ConfigDict(extra="allow")


class UsageResponse(BaseModel):
    model_config = ConfigDict(extra="allow")
