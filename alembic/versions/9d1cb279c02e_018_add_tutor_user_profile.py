"""018_add_tutor_user_profile

Revision ID: 9d1cb279c02e
Revises: 017
Create Date: 2026-08-05 12:47:21.571378

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9d1cb279c02e'
down_revision: Union[str, Sequence[str], None] = '017'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tutor_user_profile",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("user_key", sa.String, default="local", unique=True, index=True),
        sa.Column("estimated_level", sa.Integer, default=50),
        sa.Column("topics_mastery", sa.Text, nullable=True),
        sa.Column("weak_topics", sa.Text, nullable=True),
        sa.Column("strong_topics", sa.Text, nullable=True),
        sa.Column("explanation_depth", sa.String, default="medium"),
        sa.Column("response_length", sa.String, default="medium"),
        sa.Column("use_formulas", sa.Boolean, default=True),
        sa.Column("use_examples", sa.Boolean, default=True),
        sa.Column("use_step_by_step", sa.Boolean, default=True),
        sa.Column("total_sessions", sa.Integer, default=0),
        sa.Column("total_messages", sa.Integer, default=0),
        sa.Column("total_tokens", sa.Integer, default=0),
        sa.Column("helpful_count", sa.Integer, default=0),
        sa.Column("not_helpful_count", sa.Integer, default=0),
        sa.Column("helpful_rate", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("tutor_user_profile")
