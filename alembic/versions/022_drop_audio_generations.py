"""drop_audio_generations

Fitur audio (upload transkripsi Whisper + text-to-speech) dihapus permanen
dari aplikasi (routes, service, model). Tabel lama di-DROP agar skema bersih.

Revision ID: 022
Revises: 021_add_fsrs_state
Create Date: 2026-08-16

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '022'
down_revision = '021_add_fsrs_state'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table('audio_generations')


def downgrade():
    op.create_table(
        'audio_generations',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('material_id', sa.Integer(), sa.ForeignKey('materials.id', ondelete='CASCADE')),
        sa.Column('filepath', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('failure_reason', sa.String(), nullable=True),
        sa.Column('engine_used', sa.String(), nullable=True),
        sa.Column('progress', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('stage', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )