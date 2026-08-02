@echo off
title Kabayan AI v2 Launcher
color 0A
echo =========================================
echo      MENYALAKAN KABAYAN AI v2...
echo =========================================
echo.

cd /d "%~dp0"

echo Memulai frontend + backend...
start "" cmd /k "cd frontend && npm run dev:all"

echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:8000
echo.
echo Tekan Ctrl+C untuk menghentikan.
echo.

cmd /k
