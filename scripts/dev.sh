#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT/frontend-web"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
SKIP_INSTALL="${SKIP_INSTALL:-0}"
PUBLIC_TUNNEL="${PUBLIC_TUNNEL:-0}"

for arg in "$@"; do
  case "$arg" in
    --public|--tunnel)
      PUBLIC_TUNNEL=1
      ;;
  esac
done

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
  if [ ! -f "$ROOT/.venv/.backend-deps-ready" ] || [ "$ROOT/pyproject.toml" -nt "$ROOT/.venv/.backend-deps-ready" ]; then
    echo "Installing backend dependencies..."
    "$ROOT/.venv/bin/python" -m pip install -e "$ROOT[dev]"
    touch "$ROOT/.venv/.backend-deps-ready"
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

resolve_cloudflared() {
  if command -v cloudflared >/dev/null 2>&1; then
    command -v cloudflared
    return
  fi

  TOOLS_DIR="$ROOT/.tools"
  mkdir -p "$TOOLS_DIR"
  OS="$(uname -s)"
  ARCH="$(uname -m)"
  case "$OS:$ARCH" in
    Linux:x86_64)
      CLOUDFLARED_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
      ;;
    Linux:aarch64|Linux:arm64)
      CLOUDFLARED_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64"
      ;;
    Darwin:x86_64)
      CLOUDFLARED_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz"
      ;;
    Darwin:arm64)
      CLOUDFLARED_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz"
      ;;
    *)
      echo "Unsupported OS/architecture for automatic cloudflared download: $OS $ARCH" >&2
      echo "Install cloudflared manually, then rerun with --public." >&2
      exit 1
      ;;
  esac

  CLOUDFLARED_BIN="$TOOLS_DIR/cloudflared"
  if [ -x "$CLOUDFLARED_BIN" ]; then
    echo "$CLOUDFLARED_BIN"
    return
  fi

  echo "Downloading cloudflared for public tunnel..." >&2
  if [[ "$CLOUDFLARED_URL" == *.tgz ]]; then
    TMP_ARCHIVE="$TOOLS_DIR/cloudflared.tgz"
    curl -L "$CLOUDFLARED_URL" -o "$TMP_ARCHIVE"
    tar -xzf "$TMP_ARCHIVE" -C "$TOOLS_DIR"
    rm -f "$TMP_ARCHIVE"
  else
    curl -L "$CLOUDFLARED_URL" -o "$CLOUDFLARED_BIN"
  fi
  chmod +x "$CLOUDFLARED_BIN"
  echo "$CLOUDFLARED_BIN"
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
if [ "$PUBLIC_TUNNEL" = "1" ]; then
  echo "Public tunnel mode: open the trycloudflare.com URL printed below."
else
  echo "For another device on the same network, open the Network URL printed by Vite."
fi
echo ""

if [ -z "${CORS_ALLOW_ORIGIN_REGEX:-}" ]; then
  export CORS_ALLOW_ORIGIN_REGEX="https?://([a-zA-Z0-9.-]+|\[[0-9a-fA-F:]+\]):$FRONTEND_PORT"
fi

"$ROOT/.venv/bin/python" -m backend.serve --host 0.0.0.0 --port "$BACKEND_PORT" &
BACKEND_PID=$!
FRONTEND_PID=""

cleanup() {
  if [ -n "$FRONTEND_PID" ]; then
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi
  kill "$BACKEND_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

sleep 1
cd "$FRONTEND_DIR"
if [ "$PUBLIC_TUNNEL" = "1" ]; then
  VITE_API_BASE_URL="/api" VITE_BACKEND_PROXY_TARGET="http://127.0.0.1:$BACKEND_PORT" node "$FRONTEND_DIR/node_modules/vite/bin/vite.js" --host 0.0.0.0 --port "$FRONTEND_PORT" &
  FRONTEND_PID=$!
  sleep 2
  CLOUDFLARED_BIN="$(resolve_cloudflared)"
  "$CLOUDFLARED_BIN" tunnel --url "http://127.0.0.1:$FRONTEND_PORT"
else
  VITE_API_BASE_URL="" VITE_API_PORT="$BACKEND_PORT" node "$FRONTEND_DIR/node_modules/vite/bin/vite.js" --host 0.0.0.0 --port "$FRONTEND_PORT"
fi
