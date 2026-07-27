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


class StudyPlanRequest(BaseModel):
    title: Optional[str] = None
    motivational_message: str = ""
    priority_actions: list[str] = Field(default_factory=list)
    study_plan: list[dict] = Field(default_factory=list)


class ExplanationRequest(BaseModel):
    bank_id: Optional[int] = None
    question: str = ""
    correct_answer: str = ""
    topic: str = ""


class SaveHistoryRequest(BaseModel):
    subject_id: int = Field(..., gt=0)
    subject_name: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    exam_type: str = Field(..., min_length=1)
    difficulty: str = Field(..., min_length=1)
    score: int = Field(..., ge=0, le=100)
    total_correct: int = Field(..., ge=0)
    total_wrong: int = Field(..., ge=0)
    evaluation_json: str = Field(...)
    questions_json: str = Field(...)
    answers_json: str = Field(...)
    study_plan_data: Optional[dict] = None
    duration_seconds: Optional[int] = None