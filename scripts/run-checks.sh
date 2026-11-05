#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm lint
pnpm typecheck
pnpm --filter @bu2/web build
bash scripts/check-boundaries.sh
