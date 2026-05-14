@echo off
setlocal
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
) else (
  py -3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
)
