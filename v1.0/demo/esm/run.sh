#!/usr/bin/env bash
# Usage: ./run.sh [dev|build|preview|test]
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
  dev)     "$PM" run dev ;;
  build)   "$PM" run build ;;
  preview) "$PM" run preview ;;
  test)    "$PM" run test ;;
  *) echo "Usage: $0 [dev|build|preview|test]" >&2; exit 1 ;;
esac
