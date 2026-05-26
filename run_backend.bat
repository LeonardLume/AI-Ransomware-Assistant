@echo off
setlocal
cd /d "%~dp0"
echo Starting backend only ^(advanced/manual mode^).
echo For normal use, prefer start.bat or docker compose up -d --build.
if "%BACKEND_PORT%"=="" set "BACKEND_PORT=8000"
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" -m backend.serve --host 0.0.0.0 --port %BACKEND_PORT%
) else (
  py -3 -m backend.serve --host 0.0.0.0 --port %BACKEND_PORT%
)
