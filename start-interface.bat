@echo off
title SMART Aqua Pond Interface Launcher
echo ========================================================
echo   Starting SMART Aqua Pond Backend and Frontend
echo ========================================================
echo.

cd /d "%~dp0smart_aqua_pond\smart-aqua-pond-prototype\smart-aqua-pond"

echo [1/2] Launching Express Backend API (Port 4000)...
start "SMART Aqua Pond - Backend (Port 4000)" cmd /k "cd backend && npm run dev"

timeout /t 3 /nobreak >nul

echo [2/2] Launching Next.js Web Interface (Port 3000)...
start "SMART Aqua Pond - Frontend (Port 3000)" cmd /k "cd frontend && npm run dev"

timeout /t 4 /nobreak >nul

echo Opening http://localhost:3000 in your browser...
start http://localhost:3000

echo.
echo ========================================================
echo   SMART Aqua Pond Interface is running!
echo   - Web Interface : http://localhost:3000
echo   - Backend API   : http://localhost:4000
echo ========================================================

