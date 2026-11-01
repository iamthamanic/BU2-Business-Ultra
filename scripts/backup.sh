#!/usr/bin/env bash
# Local encrypted Postgres dump — RPO target ≤24h when scheduled daily.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
[ -f "$ROOT/.env" ] && set -a && source "$ROOT/.env" && set +a

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${BACKUP_DIR:-$ROOT/backups}"
mkdir -p "$OUT_DIR"
DUMP="$OUT_DIR/bu2-$STAMP.sql"
ENC="$DUMP.gpg"

echo "[backup] dumping to $DUMP"
docker compose -f "$ROOT/docker-compose.yml" exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-bu2}" -d "${POSTGRES_DB:-bu2}" --no-owner --format=plain >"$DUMP"

if [ -n "${BACKUP_GPG_RECIPIENT:-}" ]; then
  echo "[backup] encrypting for $BACKUP_GPG_RECIPIENT"
  gpg --batch --yes --encrypt -r "$BACKUP_GPG_RECIPIENT" -o "$ENC" "$DUMP"
  rm -f "$DUMP"
  echo "[backup] wrote $ENC"
else
  echo "[backup] WARNING: BACKUP_GPG_RECIPIENT unset — plaintext dump kept locally only"
  echo "[backup] wrote $DUMP"
fi

# Retention 30 days
find "$OUT_DIR" -type f \( -name 'bu2-*.sql' -o -name 'bu2-*.sql.gpg' \) -mtime +30 -delete || true
echo "[backup] done"
