"""add time_slot to study_plan_items

Revision ID: 003_add_time_slot
Revises: 002_add_start_date
"""
from alembic import op
import sqlalchemy as sa

revision = "003_add_time_slot"
down_revision = "002_add_start_date"

def upgrade():
    op.add_column("study_plan_items", sa.Column("time_slot", sa.String(), nullable=True))

def downgrade():
    op.drop_column("study_plan_items", "time_slot")
