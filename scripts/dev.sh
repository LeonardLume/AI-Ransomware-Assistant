#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT/frontend-web"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
SKIP_INSTALL="${SKIP_INSTALL:-0}"

cd "$ROOT"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found. Install Node.js 18+ and try again." >&2
  exit 1
fi

if [ ! -x "$ROOT/.venv/bin/python" ]; then
  PYTHON_BIN="${PYTHON:-python3}"
  echo "Creating Python virtual environment..."
  "$PYTHON_BIN" -m venv "$ROOT/.venv"
fi

if [ "$SKIP_INSTALL" != "1" ]; then
  if [ ! -f "$ROOT/.venv/.requirements-ready" ] || [ "$ROOT/requirements.txt" -nt "$ROOT/.venv/.requirements-ready" ]; then
    echo "Installing backend dependencies..."
    "$ROOT/.venv/bin/python" -m pip install -r "$ROOT/requirements.txt"
    touch "$ROOT/.venv/.requirements-ready"
  fi

  if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd "$FRONTEND_DIR"
    if [ -f "package-lock.json" ]; then
      npm ci
    else
      npm install
    fi
    cd "$ROOT"
  fi
fi

find_free_port() {
  "$ROOT/.venv/bin/python" - "$1" <<'PY'
import socket
import sys

preferred = int(sys.argv[1])
for port in range(preferred, preferred + 50):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind(("0.0.0.0", port))
        except OSError:
            continue
        print(port)
        raise SystemExit(0)
raise SystemExit(f"No free port found near {preferred}.")
PY
}

RESOLVED_BACKEND_PORT="$(find_free_port "$BACKEND_PORT")"
RESOLVED_FRONTEND_PORT="$(find_free_port "$FRONTEND_PORT")"
if [ "$RESOLVED_BACKEND_PORT" != "$BACKEND_PORT" ]; then
  echo "Port $BACKEND_PORT is busy; using $RESOLVED_BACKEND_PORT instead."
fi
if [ "$RESOLVED_FRONTEND_PORT" != "$FRONTEND_PORT" ]; then
  echo "Port $FRONTEND_PORT is busy; using $RESOLVED_FRONTEND_PORT instead."
fi
BACKEND_PORT="$RESOLVED_BACKEND_PORT"
FRONTEND_PORT="$RESOLVED_FRONTEND_PORT"

echo ""
echo "Backend:  http://127.0.0.1:$BACKEND_PORT"
echo "Frontend: http://localhost:$FRONTEND_PORT"
echo "For another device on the same network, open the Network URL printed by Vite."
echo ""

"$ROOT/.venv/bin/python" -m uvicorn backend.main:app --host 0.0.0.0 --port "$BACKEND_PORT" &
BACKEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

sleep 1
cd "$FRONTEND_DIR"
VITE_API_PORT="$BACKEND_PORT" npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT"
