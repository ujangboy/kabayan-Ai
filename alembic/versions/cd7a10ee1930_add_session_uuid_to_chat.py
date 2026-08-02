"""Add session_uuid to Chat

Revision ID: cd7a10ee1930
Revises: 001_initial_schema
Create Date: 2026-07-30 17:47:23.684620

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'cd7a10ee1930'
down_revision: Union[str, Sequence[str], None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('chats', sa.Column('session_uuid', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('chats', 'session_uuid')