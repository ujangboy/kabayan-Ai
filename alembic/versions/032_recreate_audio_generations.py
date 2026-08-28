"""recreate audio_generations table (fitur Audio TTS baru)

Migrasi 022 sebelumnya menghapus tabel audio_generations saat fitur audio
dibuang. Fitur ini dihidupkan kembali dengan skema baru (subject_id, voice,
file_path, duration_sec, error). Tabel dibuat ulang di sini agar fresh DB
(maupun upgrade head) memiliki tabel yang sesuai dengan models.AudioGeneration.

Revision ID: 032
Revises: 031
"""
from alembic import op
import sqlalchemy as sa

revision = '032'
down_revision = '031'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table('audio_generations'):
        # Sudah dibuat oleh Base.metadata.create_all di startup — jangan dobel.
        return
    op.create_table(
        'audio_generations',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('material_id', sa.Integer(), sa.ForeignKey('materials.id', ondelete='CASCADE'), index=True),
        sa.Column('subject_id', sa.Integer(), sa.ForeignKey('subjects.id', ondelete='CASCADE'), index=True),
        sa.Column('voice', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='Processing', index=True),
        sa.Column('progress', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('stage', sa.String(), nullable=True),
        sa.Column('file_path', sa.String(), nullable=True),
        sa.Column('duration_sec', sa.Integer(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table('audio_generations'):
        op.drop_table('audio_generations')

