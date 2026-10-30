#!/usr/bin/env bash
# scripts/install.sh — One-liner installer untuk Kabayan Pintar
# Gunakan setelah clone atau ekstrak ZIP, di dalam folder proyek.
#   bash scripts/install.sh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "==> [1/4] Menyalin .env.example -> .env (isi GROQ_API_KEY Anda di .env)"
cp -n .env.example .env 2>/dev/null || true

echo "==> [2/4] Membuat venv Python + install dependensi backend"
if [ ! -d venv ]; then
  python3 -m venv venv
fi
# shellcheck disable=SC1091
. venv/bin/activate
pip install -q -r requirements.txt

echo "==> [3/4] Install dependensi frontend (npm ci)"
(cd frontend && npm ci --silent)

echo "==> [4/4] Selesai!"
echo ""
echo "Selanjutnya jalankan:"
echo "  ./kp            # mulai backend + frontend dan buka browser"
echo "Atau secara manual:"
echo "  source venv/bin/activate && uvicorn app.main:app --reload --port 8000"
echo "  cd frontend && npm run dev"
