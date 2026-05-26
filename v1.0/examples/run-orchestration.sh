#!/usr/bin/env bash
# Usage: ./run-orchestration.sh
#   Runs the wMEP orchestration host example via tsx.
#   Mounts all 5 modules (dashboard, file-manager, kanban,
#   player, editor) under a single host.
set -euo pipefail
cd "$(dirname "$0")/.."
npx tsx examples/orchestration-host-app.ts
