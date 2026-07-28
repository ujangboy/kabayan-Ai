from pydantic import BaseModel, Field
from typing import Optional


class MCQItem(BaseModel):
    question: str = Field(..., description="Soal pilihan ganda")
    options: dict[str, str] = Field(..., description="Opsi jawaban: {'A': '...', 'B': '...', 'C': '...', 'D': '...'}")
    answer: str = Field(..., description="Kunci jawaban (huruf, misal 'A')")
    explanation: str = Field(..., description="Penjelasan mengapa jawaban benar")


class EssayItem(BaseModel):
    question: str = Field(..., description="Soal esai")
    answer_guide: str = Field(..., description="Panduan jawaban yang benar")


class QuizOutput(BaseModel):
    mcq: list[MCQItem] = Field(default_factory=list)
    essay: list[EssayItem] = Field(default_factory=list)


class FlashcardItem(BaseModel):
    question: str = Field(..., description="Pertanyaan flashcard")
    answer: str = Field(..., description="Jawaban singkat flashcard")


class FlashcardOutput(BaseModel):
    flashcards: list[FlashcardItem] = Field(default_factory=list)


class ExamQuestionItem(BaseModel):
    id: Optional[int] = None
    topic: str = Field(default="")
    type: str = Field(default="mcq")
    bloom_level: str = Field(default="")
    difficulty: str = Field(default="menengah")
    question: str = Field(...)
    options: Optional[dict[str, str]] = None
    answer: str = Field(...)
    explanation: Optional[str] = None
    material_reference: Optional[str] = None
    tips: Optional[str] = None
    choices_json: Optional[str] = None


class ExamQuestionOutput(BaseModel):
    questions: list[ExamQuestionItem] = Field(default_factory=list)