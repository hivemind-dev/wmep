#!/usr/bin/env bash
# Usage: ./run.sh
#   Runs the wMEP analytics-dashboard example via tsx.
set -euo pipefail
cd "$(dirname "$0")/../.."

if command -v pnpm >/dev/null 2>&1; then
  pnpm exec tsx examples/analytics-dashboard/host-app.ts
else
  npx tsx examples/analytics-dashboard/host-app.ts
fi
