#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/frontend-web"
if [ ! -d "node_modules" ]; then
  npm install
fi
exec npm run dev
