"""Add missing indexes: materials.upload_date, youtube_metadata.material_id, messages(chat_id, timestamp)

- materials.upload_date: dashboard recent materials ORDER BY upload_date DESC
- youtube_metadata.material_id: FK tanpa index (SQLite tidak auto-index FK),
  diquery per-material di youtube_repository
- messages(chat_id, timestamp): composite utk fetch pesan per-chat terurut waktu

Revision ID: 028
Revises: 027
Create Date: 2026-08-26

"""
from alembic import op
import sqlalchemy as sa


revision = '028'
down_revision = '027'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    def _has_index(table, name):
        return any(ix['name'] == name for ix in inspector.get_indexes(table))

    if not _has_index('materials', 'ix_materials_upload_date'):
        op.create_index('ix_materials_upload_date', 'materials', ['upload_date'])

    if not _has_index('youtube_metadata', 'ix_youtube_metadata_material_id'):
        op.create_index('ix_youtube_metadata_material_id', 'youtube_metadata', ['material_id'])

    if not _has_index('messages', 'ix_messages_chat_id_timestamp'):
        op.create_index('ix_messages_chat_id_timestamp', 'messages', ['chat_id', 'timestamp'])


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    def _has_index(table, name):
        return any(ix['name'] == name for ix in inspector.get_indexes(table))

    if _has_index('messages', 'ix_messages_chat_id_timestamp'):
        op.drop_index('ix_messages_chat_id_timestamp', table_name='messages')
    if _has_index('youtube_metadata', 'ix_youtube_metadata_material_id'):
        op.drop_index('ix_youtube_metadata_material_id', table_name='youtube_metadata')
    if _has_index('materials', 'ix_materials_upload_date'):
        op.drop_index('ix_materials_upload_date', table_name='materials')
