"""Pydantic schema untuk memvalidasi struktur output AI (B3).

Schema ini dipakai SETELAH output AI di-parse (text JSON → dict),
untuk memastikan struktur sesuai kontrak sebelum disimpan ke DB.
Kolom dibuat lenient (default kosong) agar AI yang menghasilkan
sedikit variasi field tetap bisa dipakai, bukan malah ditolak.
"""
from typing import List, Optional
from pydantic import BaseModel, Field


class QuizQuestion(BaseModel):
    question: str = ""
    options: List[str] = Field(default_factory=list)
    answer: str = ""
    model_answer: Optional[str] = None
    difficulty: Optional[str] = None
    topic: Optional[str] = None
    bloom_level: Optional[str] = None


class EssayQuestion(BaseModel):
    question: str = ""
    model_answer: Optional[str] = None
    rubric: Optional[str] = None


class QuizOutput(BaseModel):
    mcq: List[QuizQuestion] = Field(default_factory=list)
    essay: List[EssayQuestion] = Field(default_factory=list)


class FlashcardItem(BaseModel):
    question: str = ""
    answer: str = ""
    front: str = ""
    back: str = ""
    hint: Optional[str] = None


class FlashcardOutput(BaseModel):
    flashcards: List[FlashcardItem] = Field(default_factory=list)
    items: List[FlashcardItem] = Field(default_factory=list)
