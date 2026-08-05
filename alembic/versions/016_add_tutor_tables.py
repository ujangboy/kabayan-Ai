"""add_tutor_tables

Revision ID: 016
Revises: 015
Create Date: 2026-08-04

Adds:
  - tutor_faq table (SIMPLE route FAQ database)
  - tutor_templates table (formula/procedure templates)
  - messages.type column (simple/medium/complex — nullable)
  - messages.tokens_used column (nullable)
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
# down_revision points to 015 (main chain).
# The orphaned cd7a10ee1930 revision is a duplicate of 012 that was auto-generated;
# it has already been stamped and is not in the active migration chain.
revision = '016'
down_revision = '015'
branch_labels = None
depends_on = None


def upgrade():
    # ── tutor_faq ────────────────────────────────────────────────────────────
    op.create_table(
        'tutor_faq',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('mata_kuliah', sa.String(), nullable=True, index=True),
        sa.Column('topic', sa.String(), nullable=True, index=True),
        sa.Column('keywords_json', sa.Text(), nullable=True),
        sa.Column('question', sa.Text(), nullable=True),
        sa.Column('answer', sa.Text(), nullable=True),
        sa.Column('difficulty', sa.String(), nullable=True, server_default='sedang'),
        sa.Column('usage_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('effectiveness', sa.Integer(), nullable=False, server_default='80'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_by', sa.String(), nullable=True),
        sa.Column('last_updated', sa.DateTime(), nullable=True),
    )

    # ── tutor_templates ──────────────────────────────────────────────────────
    op.create_table(
        'tutor_templates',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('mata_kuliah', sa.String(), nullable=True, index=True),
        sa.Column('type', sa.String(), nullable=True, server_default='formula'),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('variables_json', sa.Text(), nullable=True),
        sa.Column('usage_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )

    # ── messages: add tutor metadata columns (nullable — zero impact on existing rows)
    op.add_column('messages', sa.Column('type', sa.String(), nullable=True))
    op.add_column('messages', sa.Column('tokens_used', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('messages', 'tokens_used')
    op.drop_column('messages', 'type')
    op.drop_table('tutor_templates')
    op.drop_table('tutor_faq')
