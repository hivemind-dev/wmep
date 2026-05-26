#!/usr/bin/env bash
# Usage: ./run.sh [dev|build|start]
set -euo pipefail
cd "$(dirname "$0")"

if command -v pnpm >/dev/null 2>&1; then
  PM=pnpm
else
  PM=npm
fi

[ -d node_modules ] || "$PM" install

mode="${1:-dev}"
case "$mode" in
  dev)   "$PM" run dev ;;
  build) "$PM" run build ;;
  start) "$PM" run start ;;
  *) echo "Usage: $0 [dev|build|start]" >&2; exit 1 ;;
esac
