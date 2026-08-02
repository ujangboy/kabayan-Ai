"""add_is_pinned_to_notes

Revision ID: 013
Revises: cd7a10ee1930
Create Date: 2026-08-02

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '013'
down_revision = '011_add_created_at_to_subjects'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('notes', sa.Column('is_pinned', sa.Boolean(), nullable=False, server_default=sa.text('0')))


def downgrade():
    op.drop_column('notes', 'is_pinned')
