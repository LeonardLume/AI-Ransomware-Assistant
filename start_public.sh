#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
exec ./scripts/dev.sh --public
