"""add material_ids to quiz and flashcard

Revision ID: 004_add_material_ids
Revises: 003_add_time_slot
Create Date: 2026-08-01

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '004_add_material_ids'
down_revision = '003_add_time_slot'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add material_ids column to flashcards table
    op.add_column('flashcards', sa.Column('material_ids', sa.Text(), nullable=True))
    
    # Add material_ids column to quizzes table
    op.add_column('quizzes', sa.Column('material_ids', sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove material_ids column from flashcards table
    op.drop_column('flashcards', 'material_ids')
    
    # Remove material_ids column from quizzes table
    op.drop_column('quizzes', 'material_ids')