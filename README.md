# Business Ultra 2 (BU2)

Greenfield modular monolith — **Vite + React + TypeScript** frontend, **Fastify + Drizzle + Postgres 16** API, Dark-Ops UI, invite-only tenancy at `/co/:slug/...` (API: `/api/b/:slug/...`).

Locked decisions: [`DECISIONS.md`](./DECISIONS.md). Routing map: [`docs/ROUTING.md`](./docs/ROUTING.md). OpenSEO fork apply notes: [`openseo/FORK_PATCH.md`](./openseo/FORK_PATCH.md). Backups: [`docs/BACKUP_RUNBOOK.md`](./docs/BACKUP_RUNBOOK.md).

Project contracts: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) · [`docs/SECURITY.md`](./docs/SECURITY.md) · [`docs/INTEGRATIONS.md`](./docs/INTEGRATIONS.md) · [`docs/OPERATIONS.md`](./docs/OPERATIONS.md) · UI [`docs/UI_STYLEGUIDE.md`](./docs/UI_STYLEGUIDE.md) · agent map [`AGENTS.md`](./AGENTS.md).

## Quick start

```bash
# Preferred local file (gitignored). Legacy `.env` still works.
cp .env.example .env.local
# Generate strong SECRETS_MASTER_KEY / SESSION_SECRET (and set BOOTSTRAP_OWNER_PASSWORD):
# node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

docker compose up -d postgres
# Full stack via Compose: use --env-file so ${POSTGRES_*} match .env.local
#   docker compose --env-file .env.local up -d postgres
pnpm install
pnpm --filter @bu2/shared build
pnpm --filter @bu2/finance-calc build
pnpm db:migrate && pnpm db:seed

# Sortanize sidecar (full lead_matching engine)
docker compose up -d --build sortanize
# or: cd services/sortanize && pip install -r requirements.txt && uvicorn app:app --port 8760

pnpm dev
```

API env priority (dev/test): process env → `.env.local` → `.env`. Production never auto-loads those files. See [`.env.example`](./.env.example) and [`.github/SECRETS.md`](./.github/SECRETS.md).

### Ports (fixed locally)

Chosen to avoid common stacks (3000/5173/8080/8000). Override only via `.env.local` / `.env` if you must.

| Service | Port | Env | URL |
|---------|------|-----|-----|
| Web (Vite) | **8741** | `WEB_PORT` | http://127.0.0.1:8741 |
| API (Fastify) | **8742** | `API_PORT` | http://127.0.0.1:8742/api/health |
| Sortanize | **8760** | — | http://127.0.0.1:8760/health |
| Postgres | **5432** | `DATABASE_URL` | docker compose |

Also set `PUBLIC_WEB_URL` / `PUBLIC_API_URL` / `CORS_ORIGIN` to match (defaults in `.env.example`).

### First login

Primary auth is **email + password**. Magic Link / OTP remains as a secondary/dev option on the login page.

| Field | Local default (from `.env.example`) |
|-------|-------------------------------------|
| Email | `raccoova@gmail.com` (`BOOTSTRAP_OWNER_EMAIL`) |
| Password | `change-me-local` (`BOOTSTRAP_OWNER_PASSWORD`) |

1. `pnpm db:migrate && pnpm db:seed` (seeds/refreshes the bootstrap password hash)
2. Open `/login` → email + password → **Anmelden**
3. Optional: expand Magic Link / OTP; without `BREVO_API_KEY`, codes print to the API console
4. Create first company (empty start) → Marketing Hub at `/co/:slug/marketing`
5. Settings → Verbindungen → paste provider keys (features stay gated until valid)

Change password while logged in: `POST /api/auth/password` with `{ "currentPassword": "…", "newPassword": "…" }`.

**Never commit real secrets.** Override `BOOTSTRAP_OWNER_PASSWORD` in `.env.local` / deploy secrets for anything beyond local. Platform OAuth client IDs live in env; per-business access tokens stay encrypted in Integration Core (Settings → Verbindungen).

Sender: `social@halteverbot123.de`.

## Checks

```bash
pnpm checks   # lint + typecheck + web build
```

UI tokens and component rules: [`docs/UI_STYLEGUIDE.md`](./docs/UI_STYLEGUIDE.md). Agent map: [`AGENTS.md`](./AGENTS.md).

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

## Recent changes

- **2026-11-04** — Unipile Telegram User (02b): QR/link personal account → sync private DMs → reply; env `UNIPILE_DSN` + `UNIPILE_ACCESS_TOKEN`
- **2026-11-04** — Omnichannel UX shell: Verbindungen hub (table + connect wizard + usage toggles); Inbox sources/filters; connect moved out of Inbox
- **2026-11-04** — Inbox Telegram E2E: connect bot → sync → thread → reply/outbox; three-pane Dark-Ops UI
- **2026-11-04** — Integration Core step 01: `connections` / credentials / bindings / sync cursors + mock adapter (`/api/b/:slug/integrations/…`)
- **2026-11-03** — CRM (Kunden), Produkte, Projekte/Tasks, Labels/Tags, Styleguide + Create-Post flow; migrations `0002`–`0010`; Dark-Ops CRM UI
- **2026-11-01** — Shell IA: Marketing (Hub/Organic/Paid/Custom/Persona/SEO/GEO) + Tools; Marketing Hub default landing; no Website dept ([docs/ROUTING.md](./docs/ROUTING.md))
- **2026-11-01** — Topbar company switcher restored (legacy-style dropdown); sidebar Companies nav removed; `/` + post-login land on `bu2_last_company`; create-first when empty
- **2026-11-01** — Topbar chips sharper (`--radius-sm`)
- **2026-11-01** — Topbar logo only; "Business Ultra" wordmark in sidebar `sb-head` (hidden when slim/collapsed)
- **2026-11-01** — BU logo moved to topbar left (links home); sidebar head keeps collapse toggle only
- **2026-11-01** — UI label Companies (not Businesses); frontend routes aligned to legacy `/co/:slug/...` with `/b/...` redirects ([docs/ROUTING.md](./docs/ROUTING.md))
