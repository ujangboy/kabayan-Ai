"""add_progress_to_materials_audio

Revision ID: 015
Revises: 014
Create Date: 2026-08-04

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '015'
down_revision = '014'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('materials', sa.Column('progress', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('materials', sa.Column('stage', sa.String(), nullable=True))
    op.add_column('audio_generations', sa.Column('progress', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('audio_generations', sa.Column('stage', sa.String(), nullable=True))
    op.add_column('audio_generations', sa.Column('updated_at', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('audio_generations', 'updated_at')
    op.drop_column('audio_generations', 'stage')
    op.drop_column('audio_generations', 'progress')
    op.drop_column('materials', 'stage')
    op.drop_column('materials', 'progress')
