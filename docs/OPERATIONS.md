<!-- contract-status: binding -->
<!-- scope: operations -->
<!-- authoritative-sources: README.md, docs/BACKUP_RUNBOOK.md, .github/SECRETS.md, docker compose, scripts/* -->
<!-- last-confirmed: 2026-11-04 (owner approved) -->

# Operations — Business Ultra 2

> Binding operations entry contract (owner-approved 2026-11-04). Prefer linking runbooks over copying.
> Detail backups: [BACKUP_RUNBOOK.md](./BACKUP_RUNBOOK.md). **UNRESOLVED** = missing runbook detail, not optional ops.

## Environments

| Env | Notes |
|-----|-------|
| Local | Docker Postgres (+ optional sortanize); `.env.local` / `.env` loaded by API in dev/test only |
| Production | Must inject env via platform secrets — API must **not** auto-load `.env.local` / `.env` |

**UNRESOLVED:** named hosting/provider SoT (which cloud / CI deploy target is canonical).

## Ports (local defaults)

| Service | Port | Health |
|---------|------|--------|
| Web | 8741 | Vite |
| API | 8742 | `/api/health` |
| Sortanize | 8760 | `/health` |
| Postgres | 5432 | Docker Compose |

Override via env (`WEB_PORT`, `API_PORT`, `DATABASE_URL`, `PUBLIC_*`, `CORS_ORIGIN`).

## Deployment

- App layout: monorepo build (`pnpm` filters for shared, finance-calc, web, api).
- OpenSEO: pin `ghcr.io/every-app/open-seo-standalone` by digest (`openseo/`).
- CI secrets inventory: [`.github/SECRETS.md`](../.github/SECRETS.md).

**UNRESOLVED:** step-by-step production deploy runbook (image build, migrate gate, rollout).

## Environment configuration

- Template: [`.env.example`](../.env.example) — names + safe placeholders only
- Never commit `.env.local` or real secrets
- Bootstrap owner credentials are local/dev defaults only — override for any shared environment

## Database migrations

```bash
pnpm db:migrate
pnpm db:seed          # bootstrap owner / local seed
# Optional local demo (fail-closed unless BU2_DEMO_SEED=1):
# pnpm db:seed:demo   # wipe businesses + 3 DE demo firms (S/M/L); owner kept
```

Schema source: `apps/api/src/db/schema.ts` + migrate tooling under `apps/api/src/db/`.

## Backup / restore

Canonical: [BACKUP_RUNBOOK.md](./BACKUP_RUNBOOK.md).

| Goal | Target |
|------|--------|
| RPO | ≤ 24h |
| RTO | ≤ 8h |

```bash
./scripts/backup.sh     # optional BACKUP_GPG_RECIPIENT
./scripts/restore.sh backups/bu2-….sql.gpg
```

Uploads volume `bu2_uploads` is **not** inside Postgres dumps — mirror separately.

## Monitoring

**UNRESOLVED (SC-05):** production metrics/log drain / uptime checks / auth-abuse spike alert. Local: Fastify logger + `/api/health`. Do not claim PASS for launch until an error drain and ≥1 abuse alert exist.

## Rollback

- App: redeploy previous artifact / git revision (**UNRESOLVED** formal procedure — Hostinger/docker tag rollback to be written per deploy target)
- DB: restore from encrypted dump per runbook; verify with migrate no-op + smoke login
- Do not delete held dumps under legal retention holds
- **SC-07:** quarterly restore checklist in [BACKUP_RUNBOOK.md](./BACKUP_RUNBOOK.md) — last rehearsal date must be recorded in ops ticket (none claimed in this hardening PR)

## Start / stop (local)

```bash
docker compose up -d postgres
# optional: docker compose up -d --build sortanize
pnpm install
pnpm --filter @bu2/shared build && pnpm --filter @bu2/finance-calc build
pnpm db:migrate && pnpm db:seed
pnpm dev
```

Stop: terminate `pnpm dev`; `docker compose stop` for containers.

## Recovery

1. Restore DB ciphertext → `restore.sh`
2. Restore uploads mirror if needed
3. Confirm env secrets present
4. Smoke: login as bootstrap/owner + open one business (runbook checklist)

## Related

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [SECURITY.md](./SECURITY.md)
- README Quick start / Backups / GitHub Secrets
