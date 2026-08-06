"""Merge orphan branch (cd7a10ee1930) ke chain utama + add topic_trend

Revision ID: c9e3f1a5d207
Revises: b7f2e9a4c105, cd7a10ee1930
Create Date: 2026-08-06

Catatan: Migration ini menggabungkan branch orphan (cd7a10ee1930_add_session_uuid_to_chat)
ke chain utama sekaligus menambah kolom topic_trend_json ke learning_profiles.

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9e3f1a5d207'
down_revision: Union[str, Sequence[str], None] = ('b7f2e9a4c105', 'cd7a10ee1930')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tambah kolom topic_trend_json ke learning_profiles
    with op.batch_alter_table("learning_profiles") as batch_op:
        batch_op.add_column(
            sa.Column("topic_trend_json", sa.Text, nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("learning_profiles") as batch_op:
        batch_op.drop_column("topic_trend_json")
