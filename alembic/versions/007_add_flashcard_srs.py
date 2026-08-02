"""add flashcard spaced repetition fields + flashcard_reviews table

Revision ID: 007_add_flashcard_srs
Revises: 006_add_quiz_tracking
Create Date: 2026-08-02

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '007_add_flashcard_srs'
down_revision = '006_add_quiz_tracking'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('flashcards', sa.Column('ease_factor', sa.Integer(), nullable=True, server_default=sa.text('250')))
    op.add_column('flashcards', sa.Column('interval', sa.Integer(), nullable=True, server_default=sa.text('1')))
    op.add_column('flashcards', sa.Column('next_review', sa.DateTime(), nullable=True))
    op.add_column('flashcards', sa.Column('times_seen', sa.Integer(), nullable=True, server_default=sa.text('0')))
    op.add_column('flashcards', sa.Column('times_correct', sa.Integer(), nullable=True, server_default=sa.text('0')))
    op.add_column('flashcards', sa.Column('last_reviewed', sa.DateTime(), nullable=True))
    op.add_column('flashcards', sa.Column('mastered', sa.Integer(), nullable=True, server_default=sa.text('0')))

    op.create_table(
        'flashcard_reviews',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('flashcard_id', sa.Integer(), nullable=False, index=True),
        sa.Column('rating', sa.Integer(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('next_review', sa.DateTime(), nullable=True),
        sa.Column('response_time_ms', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['flashcard_id'], ['flashcards.id'], ondelete='CASCADE'),
    )


def downgrade() -> None:
    op.drop_table('flashcard_reviews')
    op.drop_column('flashcards', 'mastered')
    op.drop_column('flashcards', 'last_reviewed')
    op.drop_column('flashcards', 'times_correct')
    op.drop_column('flashcards', 'times_seen')
    op.drop_column('flashcards', 'next_review')
    op.drop_column('flashcards', 'interval')
    op.drop_column('flashcards', 'ease_factor')
