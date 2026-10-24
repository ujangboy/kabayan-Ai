"""Migrate ExamHistorySession data into unified ExamSession (Alembic-native)

Pindahan dari run_exam_unification_migration() di main.py yang ternyata
tidak pernah dipanggil (dead code). Logika idempoten: jika kolom 'status'
sudah ada di exam_sessions, migrasi dianggap selesai -> cukup pastikan
tabel lama sudah dibuang.

Revision ID: 030
Revises: 028
Create Date: 2026-08-27

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from app.time_utils import utcnow


revision = '030'
down_revision = '028'
branch_labels = None
depends_on = None


def _table_exists(bind, name):
    return sa.inspect(bind).has_table(name)


def upgrade():
    bind = op.get_bind()

    # DB tanpa file sama sekali (bootstrap fresh) -> nothing to migrate
    if not _table_exists(bind, 'exam_sessions'):
        return

    sess_cols = {r[1] for r in bind.execute(text("PRAGMA table_info(exam_sessions)")).fetchall()}
    if 'status' in sess_cols:
        # Already migrated: just ensure legacy table is gone
        bind.execute(text("DROP TABLE IF EXISTS exam_history_sessions"))
        return

    if not _table_exists(bind, 'exam_history_sessions'):
        # No history to migrate; mark done by adding the status column via
        # the model — but create_all already made tables, so this branch is
        # only reached if someone dropped the column manually.
        return

    new_cols = [
        ("subject_name", "VARCHAR"),
        ("title", "VARCHAR"),
        ("exam_type", "VARCHAR"),
        ("difficulty", "VARCHAR"),
        ("bloom_level", "VARCHAR"),
        ("question_type", "VARCHAR"),
        ("total_questions", "INTEGER"),
        ("best_score", "INTEGER"),
        ("latest_score", "INTEGER"),
        ("grade", "VARCHAR"),
        ("progress", "INTEGER DEFAULT 0"),
        ("status", "VARCHAR DEFAULT 'active'"),
        ("weak_topics_json", "TEXT"),
        ("strong_topics_json", "TEXT"),
        ("updated_at", "DATETIME"),
    ]
    for col_name, col_type in new_cols:
        if col_name not in sess_cols:
            bind.execute(text(f"ALTER TABLE exam_sessions ADD COLUMN {col_name} {col_type}"))

    rows = bind.execute(text(
        "SELECT id, subject_id, subject_name, title, exam_type, difficulty, "
        "bloom_level, question_type, total_questions, best_score, latest_score, "
        "grade, progress, status, weak_topics_json, strong_topics_json, "
        "evaluation_json, questions_json, answers_json, created_at, updated_at "
        "FROM exam_history_sessions"
    )).fetchall()

    mapping = []
    for row in rows:
        (old_id, subject_id, subject_name, title, exam_type, difficulty,
         bloom_level, question_type, total_questions, best_score, latest_score,
         grade, progress, status, weak_topics_json, strong_topics_json,
         evaluation_json, questions_json, answers_json, created_at, updated_at) = row

        res = bind.execute(
            text(
                """INSERT INTO exam_sessions
                   (blueprint_id, subject_id, subject_name, title, exam_type, difficulty,
                    bloom_level, question_type, total_questions, score, best_score,
                    latest_score, grade, progress, status, weak_topics_json,
                    strong_topics_json, evaluation_json, questions_json, answers_json,
                    started_at, updated_at)
                   VALUES (NULL, :subject_id, :subject_name, :title, :exam_type, :difficulty,
                           :bloom_level, :question_type, :total_questions, :score, :best_score,
                           :latest_score, :grade, :progress, :status, :weak_topics_json,
                           :strong_topics_json, :evaluation_json, :questions_json, :answers_json,
                           :started_at, :updated_at)"""
            ),
            {
                "subject_id": subject_id, "subject_name": subject_name, "title": title,
                "exam_type": exam_type, "difficulty": difficulty, "bloom_level": bloom_level,
                "question_type": question_type, "total_questions": total_questions,
                "score": latest_score, "best_score": best_score, "latest_score": latest_score,
                "grade": grade, "progress": progress, "status": status,
                "weak_topics_json": weak_topics_json, "strong_topics_json": strong_topics_json,
                "evaluation_json": evaluation_json, "questions_json": questions_json,
                "answers_json": answers_json,
                "started_at": created_at or utcnow(),
                "updated_at": updated_at or utcnow(),
            },
        )
        mapping.append((old_id, res.lastrowid))

    if _table_exists(bind, 'exam_attempts'):
        attempt_cols = {r[1] for r in bind.execute(text("PRAGMA table_info(exam_attempts)")).fetchall()}
        if 'session_id' not in attempt_cols:
            bind.execute(text("ALTER TABLE exam_attempts ADD COLUMN session_id INTEGER"))
        for old_id, new_id in mapping:
            bind.execute(text("UPDATE exam_attempts SET session_id = :nid WHERE history_session_id = :oid"),
                         {"nid": new_id, "oid": old_id})

    if _table_exists(bind, 'study_plans'):
        plan_cols = {r[1] for r in bind.execute(text("PRAGMA table_info(study_plans)")).fetchall()}
        if 'session_id' not in plan_cols:
            bind.execute(text("ALTER TABLE study_plans ADD COLUMN session_id INTEGER"))
        for old_id, new_id in mapping:
            bind.execute(text("UPDATE study_plans SET session_id = :nid WHERE history_session_id = :oid"),
                         {"nid": new_id, "oid": old_id})

    bind.execute(text("DROP TABLE IF EXISTS exam_history_sessions"))


def downgrade():
    # Data migration one-shot; tidak dapat di-rollback dengan aman.
    pass
