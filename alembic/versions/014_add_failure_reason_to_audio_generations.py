"""add_failure_reason_to_audio_generations

Revision ID: 014
Revises: 013
Create Date: 2026-08-03

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '014'
down_revision = '013'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('audio_generations', sa.Column('failure_reason', sa.String(), nullable=True))


def downgrade():
    op.drop_column('audio_generations', 'failure_reason')
