#!/usr/bin/env bash
# Kabayan AI v2 Launcher — versi WSL / Linux
# Pengganti jalankan_kabayan.bat (cmd)

set -e

# Pindah ke direktori skrip ini (setara %~dp0)
cd "$(dirname "$0")"

echo "========================================="
echo "      MENYALAKAN KABAYAN AI v2..."
echo "========================================="
echo ""

# --- Cari interpreter Python (utamakan venv lokal) ---
if [ -x "./venv/bin/python" ]; then
  PYTHON="./venv/bin/python"
  PIP="./venv/bin/pip"
else
  PYTHON="python3"
  PIP="pip3"
fi

# --- Aktifkan venv agar PATH 'python' (dipakai npm run dev:all) menunjuk venv ---
# Tanpa ini, uvicorn lebih eksis di venv tapi npm menjalankan python sistem
# → "No module named uvicorn" saat dev:all dipanggil.
if [ -f "./venv/bin/activate" ]; then
  # shellcheck disable=SC1091
  . "./venv/bin/activate"
fi

# --- Cek dependency Python ---
if ! $PYTHON -c "import fastapi, uvicorn, lancedb, sentence_transformers" >/dev/null 2>&1; then
  echo "[!] Dependency Python belum lengkap. Menjalankan 'pip install -r requirements.txt'..."
  $PIP install -r requirements.txt
fi

# --- Cek node_modules frontend ---
if [ ! -d "frontend/node_modules" ]; then
  echo "[!] node_modules frontend belum ada. Menjalankan 'npm install' di folder frontend..."
  (cd frontend && npm install)
fi

echo "Memulai frontend (port 5173) + backend (port 8000)..."
echo "Tekan Ctrl+C untuk menghentikan kedua server."
echo ""

cd frontend && npm run dev:all
