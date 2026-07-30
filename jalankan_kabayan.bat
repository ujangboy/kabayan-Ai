@echo off
title Kabayan AI v2 Launcher
color 0A
echo =========================================
echo      MENYALAKAN KABAYAN AI v2...
echo =========================================
echo.

:: Pindah ke direktori skrip
cd /d "%~dp0"

echo Memulai server...
start "" http://localhost:8000
python -m uvicorn main:app --port 8000 --reload

pause
