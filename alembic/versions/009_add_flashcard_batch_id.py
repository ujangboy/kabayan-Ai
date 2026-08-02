"""add batch_id to flashcards

Revision ID: 009_add_flashcard_batch_id
Revises: 008_add_practice_results
Create Date: 2026-08-02

"""
from alembic import op
import sqlalchemy as sa


revision = '009_add_flashcard_batch_id'
down_revision = '008_add_practice_results'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('flashcards', sa.Column('batch_id', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('flashcards', 'batch_id')
