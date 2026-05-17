@echo off
setlocal
cd /d "%~dp0frontend-web"
echo Starting frontend only ^(advanced/manual mode^).
echo For normal use, prefer start.bat or docker compose up -d --build.
set "VITE_API_BASE_URL="
if not "%BACKEND_PORT%"=="" set "VITE_API_PORT=%BACKEND_PORT%"
if "%VITE_API_PORT%"=="" set "VITE_API_PORT=8000"
if "%FRONTEND_PORT%"=="" set "FRONTEND_PORT=5173"
if not exist "node_modules" npm install
node node_modules\vite\bin\vite.js --host 0.0.0.0 --port %FRONTEND_PORT%
