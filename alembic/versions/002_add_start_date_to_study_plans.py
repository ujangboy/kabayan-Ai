"""add start_date to study_plans

Revision ID: 002_add_start_date
Revises: 001_initial_schema
Create Date: 2026-08-01
"""

from alembic import op
import sqlalchemy as sa

revision = "002_add_start_date"
down_revision = "cd7a10ee1930"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("study_plans", sa.Column("start_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("study_plans", "start_date")
