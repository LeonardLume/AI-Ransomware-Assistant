@echo off
setlocal
cd /d "%~dp0frontend-web"
set "VITE_API_BASE_URL="
if not "%BACKEND_PORT%"=="" set "VITE_API_PORT=%BACKEND_PORT%"
if "%VITE_API_PORT%"=="" set "VITE_API_PORT=8000"
if not exist "node_modules" npm install
npm run dev
