from pydantic import BaseModel, Field
from typing import Optional


class BlueprintRequest(BaseModel):
    subject_id: int = Field(..., gt=0)
    exam_type: str = Field(..., min_length=1)
    total_questions: int = Field(..., ge=1, le=100)
    difficulty: str = Field(..., min_length=1)
    bloom_level: str = Field(..., min_length=1)
    question_type: str = Field(..., min_length=1)
    focus_material: str = Field(..., min_length=1)
    duration_minutes: Optional[int] = Field(default=None, ge=1)
    analysis_json: Optional[str] = None
    material_ids: Optional[str] = None


class SubmitAnswersRequest(BaseModel):
    answers: dict[str, str] = Field(..., min_length=1)


class RetryRequest(BaseModel):
    weak_topics: list[str] = Field(default_factory=list)
    topic_filter: Optional[str] = None
    question_type: Optional[str] = None


class StudyPlanRequest(BaseModel):
    title: Optional[str] = None
    motivational_message: str = ""
    priority_actions: list[str] = Field(default_factory=list)
    study_plan: list[dict] = Field(default_factory=list)


class SubmitPlanQuizRequest(BaseModel):
    score: int = Field(..., ge=0, le=100)
    total_questions: Optional[int] = None
    correct_count: Optional[int] = None
    time_taken_seconds: Optional[int] = None
    quiz_id: Optional[int] = None


class PlanFlashcardResult(BaseModel):
    flashcard_id: int
    rating: int = Field(..., ge=0, le=4)


class SubmitPlanFlashcardsRequest(BaseModel):
    results: list[PlanFlashcardResult] = Field(default_factory=list)