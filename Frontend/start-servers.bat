@echo off
title Kandahar WMS Server Launcher
echo ============================================
echo  Kandahar University WMS - Server Launcher
echo ============================================
echo.

echo [1/2] Starting Backend (port 3001)...
cd /d "%~dp0backend"
start "K-WMS Backend" cmd /c "npm run dev"
timeout /t 3 /nobreak >nul
echo.

echo [2/2] Starting Frontend (port 5000)...
cd /d "%~dp0"
start "K-WMS Frontend" cmd /c "npm run dev"
echo.

echo ============================================
echo  Backend:  http://localhost:3001
echo  Frontend: http://localhost:5000
echo ============================================
echo.
echo Close this window to keep servers running.
pause
