#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
PY_BIN=".venv/bin/python"
if [ ! -x "$PY_BIN" ]; then
  PY_BIN="${PYTHON:-python3}"
fi
exec "$PY_BIN" -m uvicorn backend.main:app --host 0.0.0.0 --port "${BACKEND_PORT:-8000}"
