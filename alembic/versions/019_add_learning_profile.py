"""019_add_learning_profile

Revision ID: b7f2e9a4c105
Revises: 9d1cb279c02e
Create Date: 2026-08-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7f2e9a4c105'
down_revision: Union[str, Sequence[str], None] = '9d1cb279c02e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "learning_profiles",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("user_key", sa.String, default="local", index=True),
        sa.Column("subject_id", sa.Integer, sa.ForeignKey("subjects.id", ondelete="CASCADE"), index=True),
        sa.Column("topics_mastery", sa.Text, nullable=True),
        sa.Column("weak_topics", sa.Text, nullable=True),
        sa.Column("strong_topics", sa.Text, nullable=True),
        sa.Column("estimated_level", sa.Integer, default=0),
        sa.Column("total_sessions", sa.Integer, default=0),
        sa.Column("total_questions", sa.Integer, default=0),
        sa.Column("total_correct", sa.Integer, default=0),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint("user_key", "subject_id", name="uq_learning_profile_user_subject"),
    )


def downgrade() -> None:
    op.drop_table("learning_profiles")
