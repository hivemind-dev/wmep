#!/usr/bin/env bash
# Usage: ./run.sh
#   Runs the wMEP media-player example via tsx.
set -euo pipefail
cd "$(dirname "$0")/../.."

if command -v pnpm >/dev/null 2>&1; then
  pnpm exec tsx examples/media-player/host-app.ts
else
  npx tsx examples/media-player/host-app.ts
fi
