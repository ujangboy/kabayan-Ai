"""Unique index on materials (material_type, external_id) for YouTube dedup

Mencegah race condition TOCTOU pada import YouTube: dua request paralel untuk
video yang sama sama lolos cek duplikat lalu sama-sama membuat Material.
Index unik membuat insert kedua gagal dengan IntegrityError → endpoint
membalas 409.

Data lama yang duplikat dibersihkan dulu (duplikat terlama dipertahankan,
external_id duplikat di-NULL-kan agar index bisa dibuat). Baris dengan
external_id NULL tidak ikut unik (perilaku standar SQLite).

Revision ID: 026
Revises: 025
Create Date: 2026-08-26

"""
from alembic import op
import sqlalchemy as sa


revision = '026'
down_revision = '025'
branch_labels = None
depends_on = None

INDEX_NAME = 'ix_materials_type_external_id'


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_indexes = {ix['name'] for ix in inspector.get_indexes('materials')}
    if INDEX_NAME in existing_indexes:
        return

    # Dedup: duplikat (material_type, external_id) non-null — baris terlama menang,
    # duplikat berikutnya external_id di-NULL-kan agar index unik bisa dibuat.
    bind.execute(sa.text(
        "UPDATE materials SET external_id = NULL WHERE id NOT IN ("
        "  SELECT MIN(id) FROM materials"
        "  WHERE external_id IS NOT NULL"
        "  GROUP BY material_type, external_id)"
    ))
    op.create_index(
        INDEX_NAME,
        'materials',
        ['material_type', 'external_id'],
        unique=True,
        sqlite_where=sa.text('external_id IS NOT NULL'),
    )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_indexes = {ix['name'] for ix in inspector.get_indexes('materials')}
    if INDEX_NAME in existing_indexes:
        op.drop_index(INDEX_NAME, table_name='materials')
