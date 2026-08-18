"""add_summary_to_study_plan_items

Kolom `summary` (rangkuman AI per topik) pada study_plan_items.
Kolom ini sudah dipakai oleh exam_service (get_session_detail dan
generate_study_plan_summary) tapi belum ada di model SQLAlchemy maupun
skema alembic → AttributeError → HTTP 500 pada detail ujian simulasi.

Migrasi dibuat idempotent: DB lama yang sudah punya kolom secara manual
tidak akan ditimpa/diubah.

Revision ID: 023
Revises: 022
Create Date: 2026-08-18

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '023'
down_revision = '022'
branch_labels = None
depends_on = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return column in [c["name"] for c in inspector.get_columns(table)]


def upgrade():
    if not _column_exists("study_plan_items", "summary"):
        op.add_column("study_plan_items", sa.Column("summary", sa.Text(), nullable=True))


def downgrade():
    if _column_exists("study_plan_items", "summary"):
        op.drop_column("study_plan_items", "summary")