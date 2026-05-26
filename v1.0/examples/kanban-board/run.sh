#!/usr/bin/env bash
# Usage: ./run.sh
#   Runs the wMEP kanban-board example via tsx.
set -euo pipefail
cd "$(dirname "$0")/../.."

if command -v pnpm >/dev/null 2>&1; then
  pnpm exec tsx examples/kanban-board/host-app.ts
else
  npx tsx examples/kanban-board/host-app.ts
fi
