#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/frontend-web"
if [ ! -d "node_modules" ]; then
  npm install
fi
export VITE_API_BASE_URL=""
export VITE_API_PORT="${BACKEND_PORT:-${VITE_API_PORT:-8000}}"
exec node node_modules/vite/bin/vite.js --host 0.0.0.0 --port "${FRONTEND_PORT:-5173}"
