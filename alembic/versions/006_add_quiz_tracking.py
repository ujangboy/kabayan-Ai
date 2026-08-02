"""add quiz tracking fields (timer, counts, question type)

Revision ID: 006_add_quiz_tracking
Revises: 005_add_subject_stats
Create Date: 2026-08-02

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '006_add_quiz_tracking'
down_revision = '005_add_subject_stats'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('quizzes', sa.Column('question_type', sa.String(), nullable=True))
    op.add_column('quizzes', sa.Column('total_questions', sa.Integer(), nullable=True, server_default=sa.text('0')))
    op.add_column('quizzes', sa.Column('correct_count', sa.Integer(), nullable=True))
    op.add_column('quizzes', sa.Column('wrong_count', sa.Integer(), nullable=True))
    op.add_column('quizzes', sa.Column('time_taken', sa.Integer(), nullable=True))
    op.add_column('quizzes', sa.Column('attempt_count', sa.Integer(), nullable=True, server_default=sa.text('0')))


def downgrade() -> None:
    op.drop_column('quizzes', 'attempt_count')
    op.drop_column('quizzes', 'time_taken')
    op.drop_column('quizzes', 'wrong_count')
    op.drop_column('quizzes', 'correct_count')
    op.drop_column('quizzes', 'total_questions')
    op.drop_column('quizzes', 'question_type')
