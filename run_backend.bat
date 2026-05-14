@echo off
setlocal
cd /d "%~dp0"
if "%BACKEND_PORT%"=="" set "BACKEND_PORT=8000"
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" -m uvicorn backend.main:app --host 0.0.0.0 --port %BACKEND_PORT%
) else (
  py -3 -m uvicorn backend.main:app --host 0.0.0.0 --port %BACKEND_PORT%
)
