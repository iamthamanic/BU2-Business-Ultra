# Business Ultra 2 (BU2)

Greenfield modular monolith — **Vite + React + TypeScript** frontend, **Fastify + Drizzle + Postgres 16** API, Dark-Ops UI, invite-only tenancy at `/b/:slug/...`.

Locked decisions: [`DECISIONS.md`](./DECISIONS.md). OpenSEO fork apply notes: [`openseo/FORK_PATCH.md`](./openseo/FORK_PATCH.md). Backups: [`docs/BACKUP_RUNBOOK.md`](./docs/BACKUP_RUNBOOK.md).

## Quick start

```bash
cp .env.example .env
docker compose up -d postgres
pnpm install
pnpm --filter @bu2/shared build
pnpm --filter @bu2/finance-calc build
pnpm db:migrate && pnpm db:seed

# Sortanize sidecar (full lead_matching engine)
docker compose up -d --build sortanize
# or: cd services/sortanize && pip install -r requirements.txt && uvicorn app:app --port 8760

pnpm dev
```

- Web: http://127.0.0.1:8741  
- API: http://127.0.0.1:8742/api/health  
- Sortanize: http://127.0.0.1:8760/health  

### First login

Primary auth is **email + password**. Magic Link / OTP remains as a secondary/dev option on the login page.

| Field | Local default (from `.env.example`) |
|-------|-------------------------------------|
| Email | `raccoova@gmail.com` (`BOOTSTRAP_OWNER_EMAIL`) |
| Password | `change-me-local` (`BOOTSTRAP_OWNER_PASSWORD`) |

1. `pnpm db:migrate && pnpm db:seed` (seeds/refreshes the bootstrap password hash)
2. Open `/login` → email + password → **Anmelden**
3. Optional: expand Magic Link / OTP; without `BREVO_API_KEY`, codes print to the API console
4. Create first business (empty start)
5. Settings → paste provider keys (features stay gated until valid)

Change password while logged in: `POST /api/auth/password` with `{ "currentPassword": "…", "newPassword": "…" }`.

**Never commit real secrets.** Override `BOOTSTRAP_OWNER_PASSWORD` in `.env` / deploy secrets for anything beyond local.

Sender: `social@halteverbot123.de`.

## Tests

```bash
pnpm --filter @bu2/finance-calc test   # CMB goldens + money/pricing
pnpm typecheck
pnpm --filter @bu2/web build
# Core acceptance (API must be migratable; uses /api/auth/dev/last-otp in non-production)
pnpm --filter @bu2/e2e exec playwright install chromium
E2E_NO_SERVER=1 pnpm test:e2e   # if api+web already running
# or: pnpm test:e2e
```

## Backups

```bash
./scripts/backup.sh    # optional BACKUP_GPG_RECIPIENT for ciphertext
./scripts/restore.sh backups/bu2-….sql.gpg
```

RPO ≤24h / RTO ≤8h targets — see runbook.

## GitHub Secrets

See [`.github/SECRETS.md`](./.github/SECRETS.md). Never commit real keys. Business keys live encrypted in Postgres via Settings UI.

## Layout

```
apps/web           Dark-Ops shell, icon-rail overlay, DE/EN
apps/api           Fastify modules + Metricool/Ads/Brevo/OpenSEO broker
apps/e2e           Playwright core 23B suite
packages/shared    Zod contracts
packages/finance-calc  CMB engine + goldens/templates
services/sortanize Legacy-parity FastAPI + lead_matching
openseo/           Digest pin + SSO contract + fork patch
scripts/           backup/restore
```
