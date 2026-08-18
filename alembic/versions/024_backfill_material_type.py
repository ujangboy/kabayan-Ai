"""backfill_material_type

Backfill material_type dari ekstensi filename. Sebelum commit 958b0b4,
upload_material_sync tidak mengisi material_type sehingga default kolom
'PDF' terpakai untuk SEMUA upload — termasuk .xlsx dan .pptx (contoh:
baris id=16 'Pekan 11_PAK.xlsx' dan id=17 '...ppt.pptx' tersimpan PDF).

Baris YOUTUBE (tanpa file) dan baris yang sudah sesuai ekstensi TIDAK
disentuh. Ekstensi tak dikenal dibiarkan apa adanya.

Revision ID: 024
Revises: 023
Create Date: 2026-08-18

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '024'
down_revision = '023'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    fixes = {
        '%.xlsx': 'XLSX',
        '%.pptx': 'PPTX',
        '%.pdf': 'PDF',
        '%.docx': 'DOCX',
        '%.md': 'MARKDOWN',
        '%.txt': 'TXT',
        '%.csv': 'TXT',
    }
    for pattern, mat_type in fixes.items():
        bind.execute(
            sa.text(
                "UPDATE materials SET material_type = :t "
                "WHERE material_type != 'YOUTUBE' AND material_type != :t "
                "AND filename IS NOT NULL AND lower(filename) LIKE :p"
            ),
            {"t": mat_type, "p": pattern},
        )


def downgrade():
    # Tidak ada cara aman untuk memulihkan nilai lama per-baris;
    # downgrade sengaja no-op (data backfill tidak di-revert).
    pass