@echo off
rem kp.cmd - pintu masuk Windows; semua logika ada di jalankan_kabayan.bat.
call "%~dp0jalankan_kabayan.bat" %*
exit /b %errorlevel%
