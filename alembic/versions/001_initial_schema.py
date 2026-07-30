"""initial schema — full snapshot of all models

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-07-30

Generated from models.py: Subject, Material, Note, Flashcard, Quiz, Chat,
Message, Cache, Setting, YoutubeMetadata, AudioGeneration, ExamBlueprint,
ExamSession, ExamAttempt, ExamReview, StudyPlan, StudyPlanItem, QuestionBank.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Core ──────────────────────────────────────────────────────────
    op.create_table(
        "subjects",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("semester", sa.String(), nullable=True),
        sa.Column("lecturer", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_subjects_id"), "subjects", ["id"])
    op.create_index(op.f("ix_subjects_name"), "subjects", ["name"])

    op.create_table(
        "chats",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chats_id"), "chats", ["id"])

    op.create_table(
        "settings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("key", sa.String(), nullable=True),
        sa.Column("value", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )
    op.create_index(op.f("ix_settings_id"), "settings", ["id"])
    op.create_index(op.f("ix_settings_key"), "settings", ["key"])

    # ── Material ──────────────────────────────────────────────────────
    op.create_table(
        "materials",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=True),
        sa.Column("filename", sa.String(), nullable=True),
        sa.Column("filepath", sa.String(), nullable=True),
        sa.Column("material_type", sa.Enum("PDF", "DOCX", "TXT", "MARKDOWN", "YOUTUBE", name="materialtype"), nullable=True),
        sa.Column("source_url", sa.String(), nullable=True),
        sa.Column("external_id", sa.String(), nullable=True),
        sa.Column("thumbnail", sa.String(), nullable=True),
        sa.Column("language", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("upload_date", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_materials_id"), "materials", ["id"])
    op.create_index(op.f("ix_materials_status"), "materials", ["status"])
    op.create_index(op.f("ix_materials_subject_id"), "materials", ["subject_id"])

    # ── Note ──────────────────────────────────────────────────────────
    op.create_table(
        "notes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notes_id"), "notes", ["id"])
    op.create_index(op.f("ix_notes_subject_id"), "notes", ["subject_id"])

    # ── Flashcard ─────────────────────────────────────────────────────
    op.create_table(
        "flashcards",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("question", sa.Text(), nullable=True),
        sa.Column("answer", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_flashcards_id"), "flashcards", ["id"])
    op.create_index(op.f("ix_flashcards_subject_id"), "flashcards", ["subject_id"])

    # ── Quiz ──────────────────────────────────────────────────────────
    op.create_table(
        "quizzes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("questions_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_quizzes_id"), "quizzes", ["id"])
    op.create_index(op.f("ix_quizzes_subject_id"), "quizzes", ["subject_id"])

    # ── Message ───────────────────────────────────────────────────────
    op.create_table(
        "messages",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("chat_id", sa.Integer(), nullable=True),
        sa.Column("role", sa.String(), nullable=True),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("timestamp", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["chat_id"], ["chats.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_messages_chat_id"), "messages", ["chat_id"])
    op.create_index(op.f("ix_messages_id"), "messages", ["id"])

    # ── Cache ─────────────────────────────────────────────────────────
    op.create_table(
        "caches",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("prompt_hash", sa.String(), nullable=True),
        sa.Column("context_hash", sa.String(), nullable=True),
        sa.Column("setting_hash", sa.String(), nullable=True),
        sa.Column("response", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("expired_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("prompt_hash", "context_hash", "setting_hash", name="uq_cache_hash"),
    )
    op.create_index(op.f("ix_caches_id"), "caches", ["id"])
    op.create_index(op.f("ix_caches_prompt_hash"), "caches", ["prompt_hash"])

    # ── YoutubeMetadata ───────────────────────────────────────────────
    op.create_table(
        "youtube_metadata",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("material_id", sa.Integer(), nullable=True),
        sa.Column("video_id", sa.String(), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("channel_name", sa.String(), nullable=True),
        sa.Column("channel_id", sa.String(), nullable=True),
        sa.Column("duration", sa.Integer(), nullable=True),
        sa.Column("publish_date", sa.String(), nullable=True),
        sa.Column("thumbnail_url", sa.String(), nullable=True),
        sa.Column("video_url", sa.String(), nullable=True),
        sa.Column("transcript_language", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["material_id"], ["materials.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_youtube_metadata_id"), "youtube_metadata", ["id"])
    op.create_index(op.f("ix_youtube_metadata_video_id"), "youtube_metadata", ["video_id"])

    # ── AudioGeneration ───────────────────────────────────────────────
    op.create_table(
        "audio_generations",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("material_id", sa.Integer(), nullable=True),
        sa.Column("filepath", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("engine_used", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["material_id"], ["materials.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audio_generations_id"), "audio_generations", ["id"])

    # ── Exam Blueprint ────────────────────────────────────────────────
    op.create_table(
        "exam_blueprints",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("exam_type", sa.String(), nullable=True),
        sa.Column("difficulty", sa.String(), nullable=True),
        sa.Column("bloom_level", sa.String(), nullable=True),
        sa.Column("question_type", sa.String(), nullable=True),
        sa.Column("total_questions", sa.Integer(), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("blueprint_json", sa.Text(), nullable=True),
        sa.Column("analysis_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_exam_blueprints_id"), "exam_blueprints", ["id"])
    op.create_index(op.f("ix_exam_blueprints_subject_id"), "exam_blueprints", ["subject_id"])

    # ── Exam Session ──────────────────────────────────────────────────
    op.create_table(
        "exam_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("blueprint_id", sa.Integer(), nullable=True),
        sa.Column("subject_id", sa.Integer(), nullable=True),
        sa.Column("questions_json", sa.Text(), nullable=True),
        sa.Column("answers_json", sa.Text(), nullable=True),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("total_correct", sa.Integer(), nullable=True),
        sa.Column("total_wrong", sa.Integer(), nullable=True),
        sa.Column("evaluation_json", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("subject_name", sa.String(), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("exam_type", sa.String(), nullable=True),
        sa.Column("difficulty", sa.String(), nullable=True),
        sa.Column("bloom_level", sa.String(), nullable=True),
        sa.Column("question_type", sa.String(), nullable=True),
        sa.Column("total_questions", sa.Integer(), nullable=True),
        sa.Column("best_score", sa.Integer(), nullable=True),
        sa.Column("latest_score", sa.Integer(), nullable=True),
        sa.Column("grade", sa.String(), nullable=True),
        sa.Column("progress", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("weak_topics_json", sa.Text(), nullable=True),
        sa.Column("strong_topics_json", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["blueprint_id"], ["exam_blueprints.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_exam_sessions_id"), "exam_sessions", ["id"])
    op.create_index(op.f("ix_exam_sessions_status"), "exam_sessions", ["status"])
    op.create_index(op.f("ix_exam_sessions_subject_id"), "exam_sessions", ["subject_id"])

    # ── Exam Attempt ──────────────────────────────────────────────────
    op.create_table(
        "exam_attempts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=True),
        sa.Column("attempt_number", sa.Integer(), nullable=True),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("grade", sa.String(), nullable=True),
        sa.Column("total_correct", sa.Integer(), nullable=True),
        sa.Column("total_wrong", sa.Integer(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("questions_json", sa.Text(), nullable=True),
        sa.Column("answers_json", sa.Text(), nullable=True),
        sa.Column("evaluation_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["session_id"], ["exam_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_exam_attempts_id"), "exam_attempts", ["id"])
    op.create_index(op.f("ix_exam_attempts_session_id"), "exam_attempts", ["session_id"])

    # ── Exam Review ───────────────────────────────────────────────────
    op.create_table(
        "exam_reviews",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("attempt_id", sa.Integer(), nullable=True),
        sa.Column("question_number", sa.Integer(), nullable=True),
        sa.Column("topic", sa.String(), nullable=True),
        sa.Column("question_text", sa.Text(), nullable=True),
        sa.Column("question_type", sa.String(), nullable=True),
        sa.Column("bloom_level", sa.String(), nullable=True),
        sa.Column("difficulty", sa.String(), nullable=True),
        sa.Column("user_answer", sa.Text(), nullable=True),
        sa.Column("correct_answer", sa.Text(), nullable=True),
        sa.Column("is_correct", sa.Integer(), nullable=True),
        sa.Column("ai_explanation", sa.Text(), nullable=True),
        sa.Column("material_ref", sa.String(), nullable=True),
        sa.Column("tips", sa.String(), nullable=True),
        sa.Column("item_score", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["attempt_id"], ["exam_attempts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_exam_reviews_attempt_id"), "exam_reviews", ["attempt_id"])
    op.create_index(op.f("ix_exam_reviews_id"), "exam_reviews", ["id"])

    # ── Study Plan ────────────────────────────────────────────────────
    op.create_table(
        "study_plans",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("motivational_message", sa.Text(), nullable=True),
        sa.Column("priority_actions_json", sa.Text(), nullable=True),
        sa.Column("total_days", sa.Integer(), nullable=True),
        sa.Column("completed_days", sa.Integer(), nullable=True),
        sa.Column("progress", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["session_id"], ["exam_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_study_plans_id"), "study_plans", ["id"])
    op.create_index(op.f("ix_study_plans_session_id"), "study_plans", ["session_id"])

    # ── Study Plan Item ───────────────────────────────────────────────
    op.create_table(
        "study_plan_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("plan_id", sa.Integer(), nullable=True),
        sa.Column("order_number", sa.Integer(), nullable=True),
        sa.Column("day_label", sa.String(), nullable=True),
        sa.Column("topic", sa.String(), nullable=True),
        sa.Column("activity", sa.Text(), nullable=True),
        sa.Column("activity_type", sa.String(), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("resources", sa.Text(), nullable=True),
        sa.Column("completed", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["plan_id"], ["study_plans.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_study_plan_items_id"), "study_plan_items", ["id"])
    op.create_index(op.f("ix_study_plan_items_plan_id"), "study_plan_items", ["plan_id"])

    # ── Question Bank ─────────────────────────────────────────────────
    op.create_table(
        "question_bank",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=True),
        sa.Column("blueprint_id", sa.Integer(), nullable=True),
        sa.Column("chapter", sa.String(), nullable=True),
        sa.Column("topic", sa.String(), nullable=True),
        sa.Column("difficulty", sa.String(), nullable=True),
        sa.Column("bloom_level", sa.String(), nullable=True),
        sa.Column("question_type", sa.String(), nullable=True),
        sa.Column("question", sa.Text(), nullable=True),
        sa.Column("choices_json", sa.Text(), nullable=True),
        sa.Column("correct_answer", sa.String(), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("material_ref", sa.String(), nullable=True),
        sa.Column("tips", sa.String(), nullable=True),
        sa.Column("created_by_ai", sa.Integer(), nullable=True),
        sa.Column("used_count", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["blueprint_id"], ["exam_blueprints.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_question_bank_id"), "question_bank", ["id"])
    op.create_index(op.f("ix_question_bank_subject_id"), "question_bank", ["subject_id"])
    op.create_index(op.f("ix_question_bank_topic"), "question_bank", ["topic"])
    op.create_index(op.f("ix_question_bank_difficulty"), "question_bank", ["difficulty"])
    op.create_index(op.f("ix_question_bank_question_type"), "question_bank", ["question_type"])
    op.create_index(op.f("ix_question_bank_blueprint_id"), "question_bank", ["blueprint_id"])

    # ── Additional indexes (performance) ──────────────────────────────
    op.create_index("idx_exam_sessions_subject_status_started", "exam_sessions", ["subject_id", "status", "started_at"])
    op.create_index("idx_flashcards_subject_created", "flashcards", ["subject_id", "created_at"])
    op.create_index("idx_quizzes_subject_created", "quizzes", ["subject_id", "created_at"])


def downgrade() -> None:
    op.drop_table("question_bank")
    op.drop_table("study_plan_items")
    op.drop_table("study_plans")
    op.drop_table("exam_reviews")
    op.drop_table("exam_attempts")
    op.drop_table("exam_sessions")
    op.drop_table("exam_blueprints")
    op.drop_table("audio_generations")
    op.drop_table("youtube_metadata")
    op.drop_table("caches")
    op.drop_table("messages")
    op.drop_table("quizzes")
    op.drop_table("flashcards")
    op.drop_table("notes")
    op.drop_table("materials")
    op.drop_table("settings")
    op.drop_table("chats")
    op.drop_table("subjects")