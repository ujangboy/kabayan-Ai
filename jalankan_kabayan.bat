@echo off
title Kabayan AI v2 Launcher
color 0A
echo =========================================
echo      MENYALAKAN KABAYAN AI v2...
echo =========================================
echo.

cd /d "%~dp0"

echo Memulai frontend (port 5173) + backend (port 8000)...
echo Tekan Ctrl+C untuk menghentikan kedua server.
echo.

cd frontend && npm run dev:all
