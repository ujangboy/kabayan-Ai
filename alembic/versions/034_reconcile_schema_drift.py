"""Reconcile schema drift between models and migrations.

Revision ID: 034
Revises: 033
Create Date: 2026-10-20

This migration is intentionally conservative:

* It only drops redundant legacy indexes that duplicate the canonical
  ``ix_*`` indexes already present in the database.
* It adds the two cache lookup indexes and makes ``settings.key`` unique
  for databases created purely from migrations.
* It normalises two fresh-migration type/nullability differences to the
  long-lived model contract (``audio_generations.status`` nullable and
  ``study_plan_items.time_slot`` TEXT).

No table or row data is deleted. Table rebuilds only happen on databases
that still have the migration-only mismatch; existing databases that
already match the model are left untouched.
"""
from alembic import op
import sqlalchemy as sa


revision = "034"
down_revision = "033"
branch_labels = None
depends_on = None


# Legacy duplicate indexes created by older create_all/model definitions.
# Each one is already covered by a canonical ix_* index on the same column.
LEGACY_DUPLICATE_INDEXES = (
    ("idx_exam_attempts_session_id", "exam_attempts"),
    ("idx_exam_reviews_attempt_id", "exam_reviews"),
    ("idx_exam_sessions_status", "exam_sessions"),
    ("idx_exam_sessions_subject_id", "exam_sessions"),
    ("idx_flashcards_subject_id", "flashcards"),
    ("idx_materials_status", "materials"),
    ("idx_materials_subject_id", "materials"),
    ("idx_messages_chat_id", "messages"),
    ("idx_notes_subject_id", "notes"),
    ("idx_question_bank_subject_id", "question_bank"),
    ("idx_quizzes_subject_id", "quizzes"),
    ("idx_study_plan_items_plan_id", "study_plan_items"),
    ("idx_study_plans_session_id", "study_plans"),
)

CACHE_INDEXES = (
    ("ix_caches_context_hash", "context_hash"),
    ("ix_caches_setting_hash", "setting_hash"),
)


def _index_names(inspector, table):
    return {index["name"] for index in inspector.get_indexes(table)}


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # ── Fresh-migration-only differences ──────────────────────────────
    # A database created by the historical migrations has status NOT NULL.
    # The model has always allowed NULL (the application always supplies a
    # default), and the long-lived database matches that. Normalise only the
    # migration-created variant so we do not rebuild an existing user table.
    columns = {column["name"]: column for column in inspector.get_columns("audio_generations")}
    if "status" in columns and not columns["status"]["nullable"]:
        with op.batch_alter_table("audio_generations") as batch:
            batch.alter_column(
                "status",
                existing_type=sa.String(),
                existing_server_default=sa.text("'Processing'"),
                nullable=True,
            )

    inspector = sa.inspect(bind)
    columns = {column["name"]: column for column in inspector.get_columns("study_plan_items")}
    if "time_slot" in columns and not isinstance(columns["time_slot"]["type"], sa.Text):
        with op.batch_alter_table("study_plan_items") as batch:
            batch.alter_column(
                "time_slot",
                existing_type=sa.String(),
                type_=sa.Text(),
                existing_nullable=True,
            )

    # ── Drop redundant legacy indexes ─────────────────────────────────
    inspector = sa.inspect(bind)
    for index_name, table_name in LEGACY_DUPLICATE_INDEXES:
        if index_name in _index_names(inspector, table_name):
            op.drop_index(index_name, table_name=table_name)
            inspector = sa.inspect(bind)

    # ── Cache lookup indexes missing from migration-created DBs ───────
    inspector = sa.inspect(bind)
    existing = _index_names(inspector, "caches")
    for index_name, column_name in CACHE_INDEXES:
        if index_name not in existing:
            op.create_index(index_name, "caches", [column_name])

    # ── settings.key must be unique ───────────────────────────────────
    inspector = sa.inspect(bind)
    settings_indexes = {index["name"]: index for index in inspector.get_indexes("settings")}
    key_index = settings_indexes.get("ix_settings_key")
    if key_index is not None and not key_index.get("unique"):
        op.drop_index("ix_settings_key", table_name="settings")
        key_index = None
    if key_index is None:
        op.create_index("ix_settings_key", "settings", ["key"], unique=True)


def downgrade():
    """Best-effort rollback of index cleanup.

    Type/nullability normalisation and the settings uniqueness guarantee are
    intentionally not reverted: reverting them could fail on existing data or
    reintroduce duplicate keys. Legacy duplicate indexes are recreated only
    for environments that explicitly downgrade.
    """
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    for index_name, table_name in LEGACY_DUPLICATE_INDEXES:
        if index_name not in _index_names(inspector, table_name):
            # The explicit recreate list is safer than guessing column names.
            # Only the known single-column indexes are restored.
            known_columns = {
                "idx_exam_attempts_session_id": "session_id",
                "idx_exam_reviews_attempt_id": "attempt_id",
                "idx_exam_sessions_status": "status",
                "idx_exam_sessions_subject_id": "subject_id",
                "idx_flashcards_subject_id": "subject_id",
                "idx_materials_status": "status",
                "idx_materials_subject_id": "subject_id",
                "idx_messages_chat_id": "chat_id",
                "idx_notes_subject_id": "subject_id",
                "idx_question_bank_subject_id": "subject_id",
                "idx_quizzes_subject_id": "subject_id",
                "idx_study_plan_items_plan_id": "plan_id",
                "idx_study_plans_session_id": "session_id",
            }
            op.create_index(index_name, table_name, [known_columns[index_name]])
            inspector = sa.inspect(bind)

    inspector = sa.inspect(bind)
    for index_name, _column_name in CACHE_INDEXES:
        if index_name in _index_names(inspector, "caches"):
            op.drop_index(index_name, table_name="caches")
            inspector = sa.inspect(bind)
