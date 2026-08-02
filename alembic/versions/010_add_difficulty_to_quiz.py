"""Add difficulty column to quizzes

Revision ID: 010_add_difficulty_to_quiz
Revises: 009_add_flashcard_batch_id
Create Date: 2026-08-02
"""
from typing import Union, Sequence
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '010_add_difficulty_to_quiz'
down_revision: Union[str, Sequence[str], None] = '009_add_flashcard_batch_id'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('quizzes', sa.Column('difficulty', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('quizzes', 'difficulty')
