#!/usr/bin/env bash
# ============================================================
# Kabayan Pintar — Backup Otomatis Harian
# ------------------------------------------------------------
# Dipanggil Windows Task Scheduler lewat:
#   wsl.exe -d Ubuntu-24.04 --cd /home/a7916/Projects/kabayan-agent \
#     -- bash scripts/auto_backup.sh
#
# Yang dikerjakan:
#   1. create_backup() — ZIP konsisten (kabayan.db via SQLite backup
#      API + seluruh uploads), sama seperti tombol backup di app.
#   2. ZIP dikirim ke partisi 01_Uromastyx_VScode (D:).
#   3. Retensi: sisakan 14 ZIP terbaru; arsip lama & database
#      pra-migrasi (kabayan_pre_*.db) tidak disentuh.
#   4. Tulis satu baris log ke backup.log.
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="/mnt/d/01_Uromastyx_VScode/Kabayan-Backup"
KEEP=14

mkdir -p "$DEST"
cd "$ROOT"

JSON=$(./venv/bin/python - <<'PY'
import json
from services.backup_service import create_backup
print(json.dumps(create_backup(), default=str))
PY
)
ZIP=$(echo "$JSON" | sed -n 's/.*"path": "\([^"]*\)".*/\1/p')

if [ ! -f "$ZIP" ]; then
  echo "GAGAL: file backup tidak ditemukan: $ZIP" >&2
  exit 1
fi

cp -f "$ZIP" "$DEST/"

# Retensi: sisakan KEEP ZIP reguler terbackup (kabayan_backup_*.zip);
# file lain (mis. kabayan_pre_*.db) tidak diproses sama sekali.
(cd "$DEST" && ls -t kabayan_backup_*.zip 2>/dev/null | tail -n "+$((KEEP + 1))" | xargs -r rm -f)

N=$(ls "$DEST"/kabayan_backup_*.zip 2>/dev/null | wc -l)
LOG="$DEST/backup.log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] OK ${ZIP##*/} -> $DEST (tersimpan: $N)" >> "$LOG"
echo "OK ${ZIP##*/} -> $DEST (tersimpan: $N)"
