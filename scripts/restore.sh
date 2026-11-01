#!/usr/bin/env bash
# Restore from encrypted or plaintext dump. RTO target ≤8h including verification.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="${1:-}"
if [ -z "$FILE" ]; then
  echo "Usage: $0 <bu2-YYYYMMDD.sql[.gpg]>"
  exit 1
fi
[ -f "$ROOT/.env" ] && set -a && source "$ROOT/.env" && set +a

TMP="$FILE"
if [[ "$FILE" == *.gpg ]]; then
  TMP="$(mktemp)"
  gpg --batch --yes --decrypt -o "$TMP" "$FILE"
fi

echo "[restore] restoring $FILE (destructive to current DB)"
docker compose -f "$ROOT/docker-compose.yml" exec -T postgres \
  psql -U "${POSTGRES_USER:-bu2}" -d "${POSTGRES_DB:-bu2}" <"$TMP"

if [[ "$FILE" == *.gpg ]]; then rm -f "$TMP"; fi
echo "[restore] complete — run smoke: curl -s \$PUBLIC_API_URL/api/health"
