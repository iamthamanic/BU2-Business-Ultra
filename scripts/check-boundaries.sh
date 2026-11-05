#!/usr/bin/env bash
# Fail if apps/web imports Drizzle / API DB / SQL tags (ARCHITECTURE forbidden deps).
set -euo pipefail
cd "$(dirname "$0")/.."

ROOT="apps/web/src"
if [[ ! -d "$ROOT" ]]; then
  echo "check-boundaries: skip (no $ROOT)"
  exit 0
fi

hits="$(
  rg -n --glob '*.{ts,tsx}' \
    -e "from ['\"]drizzle-orm" \
    -e "from ['\"].*apps/api" \
    -e "from ['\"].*/db/schema" \
    -e "from ['\"].*/db/client" \
    -e "sql\`" \
    "$ROOT" || true
)"

if [[ -n "$hits" ]]; then
  echo "check-boundaries: FORBIDDEN imports in apps/web:"
  echo "$hits"
  exit 1
fi

echo "check-boundaries: ok (no SQL/Drizzle/api-db imports in apps/web)"
