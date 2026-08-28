"""add_tutor_enabled_to_chat

Revision ID: 031
Revises: 030
Create Date: 2026-08-27

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '031'
down_revision = '030'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('chats', sa.Column('tutor_enabled', sa.Boolean(), nullable=False, server_default=sa.text('0')))


def downgrade():
    op.drop_column('chats', 'tutor_enabled')
