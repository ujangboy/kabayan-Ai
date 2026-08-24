#!/usr/bin/env bash
# ============================================================
# Install Git hooks lokal agar secret-scan aktif untuk semua dev.
# Jalankan sekali: bash scripts/security/install-hooks.sh
# ============================================================
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

git config core.hooksPath .githooks
chmod +x .githooks/pre-commit

echo "✅ Git hooks diarahkan ke .githooks/"
echo "   Pre-commit secret scanner aktif."
echo "   Verifikasi: git config core.hooksPath"
