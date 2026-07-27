import pytest
from pydantic import ValidationError
from schemas.exam import (
    BlueprintRequest,
    SubmitAnswersRequest,
    RetryRequest,
    StudyPlanRequest,
    ExplanationRequest,
    SaveHistoryRequest,
)


class TestBlueprintRequest:
    def test_valid_minimal(self):
        payload = BlueprintRequest(
            subject_id=1,
            exam_type="UTS",
            total_questions=20,
            difficulty="medium",
            bloom_level="C4",
            question_type="multiple_choice",
            focus_material="Chapter 1",
        )
        assert payload.subject_id == 1
        assert payload.total_questions == 20
        assert payload.duration_minutes is None

    def test_valid_with_optional_fields(self):
        payload = BlueprintRequest(
            subject_id=1,
            exam_type="UAS",
            total_questions=30,
            difficulty="hard",
            bloom_level="C6",
            question_type="essay",
            focus_material="Semua",
            duration_minutes=120,
            analysis_json='{"key": "value"}',
            material_ids="1,2,3",
        )
        assert payload.duration_minutes == 120
        assert payload.analysis_json == '{"key": "value"}'
        assert payload.material_ids == "1,2,3"

    def test_invalid_subject_id_zero(self):
        with pytest.raises(ValidationError):
            BlueprintRequest(
                subject_id=0,
                exam_type="UTS",
                total_questions=20,
                difficulty="medium",
                bloom_level="C4",
                question_type="multiple_choice",
                focus_material="Chapter 1",
            )

    def test_invalid_negative_questions(self):
        with pytest.raises(ValidationError):
            BlueprintRequest(
                subject_id=1,
                exam_type="UTS",
                total_questions=-1,
                difficulty="medium",
                bloom_level="C4",
                question_type="multiple_choice",
                focus_material="Chapter 1",
            )

    def test_invalid_excessive_questions(self):
        with pytest.raises(ValidationError):
            BlueprintRequest(
                subject_id=1,
                exam_type="UTS",
                total_questions=101,
                difficulty="medium",
                bloom_level="C4",
                question_type="multiple_choice",
                focus_material="Chapter 1",
            )

    def test_empty_exam_type(self):
        with pytest.raises(ValidationError):
            BlueprintRequest(
                subject_id=1,
                exam_type="",
                total_questions=20,
                difficulty="medium",
                bloom_level="C4",
                question_type="multiple_choice",
                focus_material="Chapter 1",
            )


class TestSubmitAnswersRequest:
    def test_valid_answers(self):
        payload = SubmitAnswersRequest(answers={"1": "A", "2": "B", "3": "C"})
        assert len(payload.answers) == 3
        assert payload.answers["1"] == "A"

    def test_empty_answers_raises(self):
        with pytest.raises(ValidationError):
            SubmitAnswersRequest(answers={})


class TestRetryRequest:
    def test_default_empty_weak_topics(self):
        payload = RetryRequest()
        assert payload.weak_topics == []

    def test_with_weak_topics(self):
        payload = RetryRequest(weak_topics=["topic_a", "topic_b"])
        assert payload.weak_topics == ["topic_a", "topic_b"]


class TestStudyPlanRequest:
    def test_default_empty_fields(self):
        payload = StudyPlanRequest()
        assert payload.title is None
        assert payload.motivational_message == ""
        assert payload.priority_actions == []
        assert payload.study_plan == []

    def test_with_all_fields(self):
        payload = StudyPlanRequest(
            title="Study Plan",
            motivational_message="You can do it!",
            priority_actions=["review chapter 1", "practice questions"],
            study_plan=[{"day": 1, "topic": "algebra"}],
        )
        assert payload.title == "Study Plan"
        assert len(payload.priority_actions) == 2


class TestExplanationRequest:
    def test_all_fields_optional(self):
        payload = ExplanationRequest()
        assert payload.bank_id is None
        assert payload.question == ""

    def test_with_bank_id(self):
        payload = ExplanationRequest(
            bank_id=42, question="What is 2+2?", correct_answer="4", topic="math"
        )
        assert payload.bank_id == 42


class TestSaveHistoryRequest:
    def test_valid_history(self):
        payload = SaveHistoryRequest(
            subject_id=1,
            subject_name="Matematika",
            title="UTS Genap",
            exam_type="UTS",
            difficulty="medium",
            score=85,
            total_correct=17,
            total_wrong=3,
            evaluation_json='{"score": 85}',
            questions_json='[]',
            answers_json='{}',
        )
        assert payload.score == 85
        assert payload.duration_seconds is None

    def test_invalid_subject_id_zero(self):
        with pytest.raises(ValidationError):
            SaveHistoryRequest(
                subject_id=0,
                subject_name="x",
                title="t",
                exam_type="t",
                difficulty="t",
                score=0,
                total_correct=0,
                total_wrong=0,
                evaluation_json="{}",
                questions_json="[]",
                answers_json="{}",
            )