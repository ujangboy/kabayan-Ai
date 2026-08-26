"""Add trash_items + usage_logs tables and unique index on chats.session_uuid

Tabel trash_items dan usage_logs sebelumnya HANYA dibuat via
Base.metadata.create_all() saat startup — tidak punya migrasi Alembic, sehingga
DB yang dibangun murni dari chain migrasi akan crash saat fitur trash/usage
dipakai. Migrasi ini menyelaraskan Alembic dengan models.py.

chats.session_uuid di models.py dideklarasikan unique+indexed, tetapi migrasi
cd7a10ee1930 hanya menambah kolom polos. Index unik ditambahkan di sini
(setelah dedup aman: duplikat di-null-kan, NULL tidak dianggap duplikat SQLite).

Revision ID: 025
Revises: 024
Create Date: 2026-08-26

"""
from alembic import op
import sqlalchemy as sa


revision = '025'
down_revision = '024'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    # ── trash_items ──────────────────────────────────────────────────────
    if 'trash_items' not in existing_tables:
        op.create_table(
            'trash_items',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('material_id', sa.Integer(), nullable=True),
            sa.Column('source_type', sa.String(), nullable=True, server_default='material'),
            sa.Column('original_path', sa.String(), nullable=True),
            sa.Column('trash_path', sa.String(), nullable=True),
            sa.Column('original_filename', sa.String(), nullable=True),
            sa.Column('original_status', sa.String(), nullable=True),
            sa.Column('size_bytes', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('trashed_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_trash_items_id', 'trash_items', ['id'])
        op.create_index('ix_trash_items_material_id', 'trash_items', ['material_id'])

    # ── usage_logs ───────────────────────────────────────────────────────
    if 'usage_logs' not in existing_tables:
        op.create_table(
            'usage_logs',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('feature', sa.String(), nullable=True),
            sa.Column('tokens', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('calls', sa.Integer(), nullable=True, server_default='1'),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_usage_logs_id', 'usage_logs', ['id'])
        op.create_index('ix_usage_logs_feature', 'usage_logs', ['feature'])
        op.create_index('ix_usage_logs_created_at', 'usage_logs', ['created_at'])

    # ── chats.session_uuid unique index (dengan dedup aman) ──────────────
    existing_indexes = {ix['name'] for ix in inspector.get_indexes('chats')}
    if 'ix_chats_session_uuid' not in existing_indexes:
        # Dedup: baris duplikat non-null di-null-kan (baris terlama menang)
        bind.execute(sa.text(
            "UPDATE chats SET session_uuid = NULL WHERE id NOT IN ("
            "  SELECT MIN(id) FROM chats WHERE session_uuid IS NOT NULL"
            "  GROUP BY session_uuid)"
        ))
        op.create_index('ix_chats_session_uuid', 'chats', ['session_uuid'], unique=True)


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    existing_indexes = {ix['name'] for ix in inspector.get_indexes('chats')}
    if 'ix_chats_session_uuid' in existing_indexes:
        op.drop_index('ix_chats_session_uuid', table_name='chats')

    if 'usage_logs' in existing_tables:
        op.drop_table('usage_logs')

    if 'trash_items' in existing_tables:
        op.drop_table('trash_items')
