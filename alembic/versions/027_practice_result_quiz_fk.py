"""Add FK quiz_id -> quizzes.id (SET NULL) on practice_results

Sebelumnya quiz_id kolom polos tanpa FK: menghapus quiz meninggalkan row
practice_results yang menunjuk quiz yang sudah tidak ada. Kini:
- Data lama yang dangling dibersihkan (quiz_id -> NULL)
- FK dengan ondelete=SET NULL ditambahkan via batch_alter_table (SQLite
  merekreasi tabel — aman untuk tabel kecil ini)

Revision ID: 027
Revises: 026
Create Date: 2026-08-26

"""
from alembic import op
import sqlalchemy as sa


revision = '027'
down_revision = '026'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()

    # Bersihkan referensi yatim dari data lama
    bind.execute(sa.text(
        "UPDATE practice_results SET quiz_id = NULL WHERE quiz_id IS NOT NULL AND quiz_id NOT IN (SELECT id FROM quizzes)"
    ))

    with op.batch_alter_table('practice_results') as batch_op:
        # Index untuk kolom yang jadi FK (dibuat dulu jika belum ada)
        batch_op.create_index('ix_practice_results_quiz_id', ['quiz_id'])
        batch_op.drop_column('quiz_id')
        batch_op.add_column(sa.Column('quiz_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_practice_results_quiz_id', 'quizzes', ['quiz_id'], ['id'], ondelete='SET NULL'
        )


def downgrade():
    with op.batch_alter_table('practice_results') as batch_op:
        batch_op.drop_constraint('fk_practice_results_quiz_id', type_='foreignkey')
        batch_op.drop_column('quiz_id')
        batch_op.add_column(sa.Column('quiz_id', sa.Integer(), nullable=True))
        batch_op.drop_index('ix_practice_results_quiz_id')
