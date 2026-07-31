from pydantic import BaseModel, Field, field_validator
from typing import Optional


def _sanitize(v):
    from services.json_utils import sanitize_output
    return sanitize_output(v) if isinstance(v, str) else v


class MCQItem(BaseModel):
    question: str = Field(..., description="Soal pilihan ganda")
    options: dict[str, str] = Field(..., description="Opsi jawaban: {'A': '...', 'B': '...', 'C': '...', 'D': '...'}")
    answer: str = Field(..., description="Kunci jawaban (huruf, misal 'A')")
    explanation: str = Field(..., description="Penjelasan mengapa jawaban benar")

    @field_validator("question", "answer", "explanation", mode="before")
    @classmethod
    def clean_text(cls, v):
        return _sanitize(v)

    @field_validator("options", mode="before")
    @classmethod
    def clean_options(cls, v):
        if isinstance(v, dict):
            return {k: _sanitize(val) for k, val in v.items()}
        return v


class EssayItem(BaseModel):
    question: str = Field(..., description="Soal esai")
    answer_guide: str = Field(..., description="Panduan jawaban yang benar")

    @field_validator("question", "answer_guide", mode="before")
    @classmethod
    def clean_text(cls, v):
        return _sanitize(v)


class QuizOutput(BaseModel):
    mcq: list[MCQItem] = Field(default_factory=list)
    essay: list[EssayItem] = Field(default_factory=list)


class FlashcardItem(BaseModel):
    question: str = Field(..., description="Pertanyaan flashcard")
    answer: str = Field(..., description="Jawaban singkat flashcard")

    @field_validator("question", "answer", mode="before")
    @classmethod
    def clean_text(cls, v):
        return _sanitize(v)


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

    @field_validator(
        "topic", "bloom_level", "question", "answer",
        "explanation", "material_reference", "tips", mode="before",
    )
    @classmethod
    def clean_text(cls, v):
        return _sanitize(v)

    @field_validator("options", mode="before")
    @classmethod
    def clean_options(cls, v):
        if isinstance(v, dict):
            return {k: _sanitize(val) for k, val in v.items()}
        return v


class ExamQuestionOutput(BaseModel):
    questions: list[ExamQuestionItem] = Field(default_factory=list)
