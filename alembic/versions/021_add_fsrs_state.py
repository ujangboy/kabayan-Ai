"""add fsrs_state column to flashcards

Revision ID: 021_add_fsrs_state
Revises: c9e3f1a5d207
Create Date: 2026-08-06

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '021_add_fsrs_state'
down_revision = 'c9e3f1a5d207'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('flashcards', sa.Column('fsrs_state', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('flashcards', 'fsrs_state')
