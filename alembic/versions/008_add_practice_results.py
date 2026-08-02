"""add practice_results table for study plan integration

Revision ID: 008_add_practice_results
Revises: 007_add_flashcard_srs
Create Date: 2026-08-02

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '008_add_practice_results'
down_revision = '007_add_flashcard_srs'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'practice_results',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('plan_item_id', sa.Integer(), nullable=False, index=True),
        sa.Column('session_id', sa.Integer(), nullable=True, index=True),
        sa.Column('practice_type', sa.String(), nullable=True),
        sa.Column('quiz_id', sa.Integer(), nullable=True),
        sa.Column('score', sa.Integer(), nullable=True),
        sa.Column('total_questions', sa.Integer(), nullable=True),
        sa.Column('correct_count', sa.Integer(), nullable=True),
        sa.Column('flashcard_reviewed', sa.Integer(), nullable=True),
        sa.Column('time_taken_seconds', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['plan_item_id'], ['study_plan_items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['session_id'], ['exam_sessions.id'], ondelete='CASCADE'),
    )


def downgrade() -> None:
    op.drop_table('practice_results')
