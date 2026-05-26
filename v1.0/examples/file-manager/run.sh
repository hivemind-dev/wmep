#!/usr/bin/env bash
# Usage: ./run.sh
#   Runs the wMEP file-manager example via tsx.
set -euo pipefail
cd "$(dirname "$0")/../.."

if command -v pnpm >/dev/null 2>&1; then
  pnpm exec tsx examples/file-manager/host-app.ts
else
  npx tsx examples/file-manager/host-app.ts
fi
