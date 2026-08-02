"""Add created_at column to subjects

Revision ID: 011_add_created_at_to_subjects
Revises: 010_add_difficulty_to_quiz
Create Date: 2026-08-02
"""
from typing import Union, Sequence
import sqlalchemy as sa
from alembic import op

revision: str = '011_add_created_at_to_subjects'
down_revision: Union[str, Sequence[str], None] = '010_add_difficulty_to_quiz'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('subjects', sa.Column('created_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('subjects', 'created_at')
