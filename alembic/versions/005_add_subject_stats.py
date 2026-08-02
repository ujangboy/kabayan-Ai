"""add subject aggregate stats fields

Revision ID: 005_add_subject_stats
Revises: 004_add_material_ids
Create Date: 2026-08-02

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '005_add_subject_stats'
down_revision = '004_add_material_ids'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('subjects', sa.Column('best_score', sa.Integer(), nullable=True))
    op.add_column('subjects', sa.Column('avg_score', sa.Integer(), nullable=True))
    op.add_column('subjects', sa.Column('total_quizzes', sa.Integer(), nullable=True, server_default=sa.text('0')))
    op.add_column('subjects', sa.Column('total_flashcards', sa.Integer(), nullable=True, server_default=sa.text('0')))
    op.add_column('subjects', sa.Column('total_materials', sa.Integer(), nullable=True, server_default=sa.text('0')))
    op.add_column('subjects', sa.Column('last_activity_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('subjects', 'last_activity_at')
    op.drop_column('subjects', 'total_materials')
    op.drop_column('subjects', 'total_flashcards')
    op.drop_column('subjects', 'total_quizzes')
    op.drop_column('subjects', 'avg_score')
    op.drop_column('subjects', 'best_score')
