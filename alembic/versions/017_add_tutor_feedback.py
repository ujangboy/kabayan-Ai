"""add_tutor_feedback

Revision ID: 017
Revises: 016
Create Date: 2026-08-04

Adds:
  - tutor_feedback table (rating/comment/flag per AI tutor message)
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '017'
down_revision = '016'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'tutor_feedback',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('message_id', sa.Integer(),
                  sa.ForeignKey('messages.id', ondelete='CASCADE'), index=True),
        sa.Column('chat_id', sa.Integer(),
                  sa.ForeignKey('chats.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('user_key', sa.String(), nullable=False, server_default='local', index=True),
        sa.Column('rating', sa.String(), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('flag', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_table('tutor_feedback')
