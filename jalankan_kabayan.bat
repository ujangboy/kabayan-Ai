@echo off
setlocal
title Kabayan Pintar v2 Launcher
color 0A
pushd "%~dp0" >nul

if /i "%~1"=="--install" goto install
if /i "%~1"=="install" goto install
if "%~1"=="" goto run
if /i "%~1"=="run" goto run
if /i "%~1"=="start" goto run
echo Penggunaan: kp [--install]
exit /b 1

:install
echo =========================================
echo      INSTALL KABAYAN PINTAR v2...
echo =========================================
echo.
if not exist ".env" copy /y ".env.example" ".env" >nul
if not exist "venv\Scripts\python.exe" (
  echo Membuat venv Python...
  python -m venv venv
  if errorlevel 1 goto fail
)
call "venv\Scripts\activate.bat"
echo Install dependensi backend...
python -m pip install -q -r requirements.txt
if errorlevel 1 goto fail
echo Install dependensi frontend...
pushd frontend
call npm ci --silent
if errorlevel 1 goto fail_popd
popd
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install_windows_path.ps1"
if errorlevel 1 goto pathfail
echo.
echo Selesai install. Tutup lalu buka terminal baru, ketik: kp
exit /b 0

:pathfail
echo [!] Gagal mendaftarkan PATH. Tambahkan folder proyek manual ke PATH:
echo     %CD%
exit /b 1

:run
if not exist "venv\Scripts\activate.bat" goto notinstalled
if not exist "frontend\node_modules" goto notinstalled
call "venv\Scripts\activate.bat"
echo =========================================
echo      MENYALAKAN KABAYAN PINTAR v2...
echo =========================================
echo.
echo Memulai frontend (port 5173) + backend (port 8000)...
echo Tekan Ctrl+C untuk menghentikan kedua server.
echo.
pushd frontend
call npm run dev:all
popd
exit /b %errorlevel%

:notinstalled
echo [!] Belum diinstall. Jalankan: kp --install
exit /b 1

:fail_popd
popd
:fail
echo [!] Install gagal. Periksa pesan di atas.
exit /b 1
