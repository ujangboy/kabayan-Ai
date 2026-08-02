"""add session_uuid to chats for existing databases

Revision ID: 012_add_session_uuid_to_chats
Revises: cd7a10ee1930
Create Date: 2026-08-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision = '012_add_session_uuid_to_chats'
down_revision = 'cd7a10ee1930'
branch_labels = None
depends_on = None


def upgrade() -> None:
    if not op.column_exists('chats', 'session_uuid'):
        op.add_column('chats', sa.Column('session_uuid', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('chats', 'session_uuid')