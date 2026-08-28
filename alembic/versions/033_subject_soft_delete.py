"""Subject soft-delete: tambah kolom status ('active' | 'trashed')

Menghindari hard-delete subject yang memicu cascade hapus materi, sesi ujian,
quiz, flashcard, dan rencana belajar sekaligus. Hapus sekarang memindahkan
subject ke trash (status='trashed') dan bisa dipulihkan.

Revision ID: 033
Revises: 032
Create Date: 2026-08-28

"""
from alembic import op
import sqlalchemy as sa


revision = '033'
down_revision = '032'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = [c['name'] for c in inspector.get_columns('subjects')]
    if 'status' not in cols:
        op.add_column(
            'subjects',
            sa.Column('status', sa.String(length=20), nullable=True, server_default='active'),
        )
        op.execute("UPDATE subjects SET status = 'active' WHERE status IS NULL")


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = [c['name'] for c in inspector.get_columns('subjects')]
    if 'status' in cols:
        op.drop_column('subjects', 'status')
