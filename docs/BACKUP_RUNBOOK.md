# Backup / Restore runbook (V1 targets)

| Goal | Target | Notes |
|---|---|---|
| RPO | ≤ 24h | Schedule `scripts/backup.sh` daily via cron/GitHub scheduled runner off-host |
| RTO | ≤ 8h | Includes decrypt, restore, migrate check, smoke login |

## Encrypted off-host

1. Create a GPG recipient key offline; store private key in hardware / sealed ops vault (never in git).
2. Set `BACKUP_GPG_RECIPIENT` and optionally `BACKUP_DIR` on the backup host.
3. Copy `*.sql.gpg` to off-host object storage (S3/B2/rsync) — ciphertext only.
4. Retention: 30 rolling days (`backup.sh` prunes local); mirror retention off-host.

## Legal / retention exceptions

Document holds that block purge in ops ticket; do not delete held dumps.

## Verification checklist (quarterly)

- [ ] Decrypt sample dump on clean machine
- [ ] `restore.sh` into disposable Postgres
- [ ] `pnpm db:migrate` no-op / compatible
- [ ] Login as bootstrap owner + open one business
- [ ] Confirm uploads volume restored separately if used (`bu2_uploads`)

## Uploads volume

Postgres dump does **not** include `/data/uploads`. Mirror `bu2_uploads` with the same cadence (rsync/tar+gpg).
