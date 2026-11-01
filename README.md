# Business Ultra 2 (BU2)

Greenfield modular monolith — **Vite + React + TypeScript** frontend, **Fastify + Drizzle + Postgres 16** API, Dark-Ops UI, invite-only tenancy at `/b/:slug/...`.

Locked decisions: see [`DECISIONS.md`](./DECISIONS.md). Product contract: PRD v2.3 (round 10).

## Quick start (local)

```bash
cp .env.example .env
# edit secrets if desired — defaults work for local console auth

# Option A — Docker (Postgres + API + Web + Sortanize)
docker compose up -d --build

# Option B — Dev processes
docker compose up -d postgres sortanize
pnpm install
pnpm --filter @bu2/shared build
pnpm --filter @bu2/finance-calc build
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- Web: http://127.0.0.1:8741  
- API: http://127.0.0.1:8742/api/health  
- Sortanize: http://127.0.0.1:8760/health  

### First login

1. Open http://127.0.0.1:8741/login  
2. Bootstrap owner email: `raccoova@gmail.com`  
3. Without `BREVO_API_KEY`, the API prints magic link + OTP to the console  
4. Create the first business (empty start)  

Sender for live Brevo: `social@halteverbot123.de`.

## Monorepo layout

```
apps/web          Vite React Dark-Ops shell (icon rail, DE/EN)
apps/api          Fastify + Zod + Drizzle
packages/shared   Shared types / Zod schemas
packages/finance-calc  CMB pure calc + golden fixture
services/sortanize     Python matching sidecar
openseo/          Image pin + SSO contract stubs
```

## GitHub Secrets (required names)

Never commit real values. Set these in the GitHub repo settings:

| Secret | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `SECRETS_MASTER_KEY` | AES seal key for business API keys at rest |
| `SESSION_SECRET` | Session cookie signing |
| `BREVO_API_KEY` | Platform magic-link / OTP mail |
| `BREVO_SENDER_EMAIL` | Default `social@halteverbot123.de` |
| `BOOTSTRAP_OWNER_EMAIL` | Default `raccoova@gmail.com` |
| `OPENSEO_SSO_SHARED_SECRET` | SSO redeem HMAC / bearer |
| `OPENSEO_BASE_URL` | OpenSEO launch base |
| `OPENSEO_IMAGE_DIGEST` | Pinned standalone digest |
| `CORS_ORIGIN` / `PUBLIC_WEB_URL` / `PUBLIC_API_URL` | Deploy URLs |

Business-scoped keys (Metricool, Paid Ads, Brevo send, ChatGPT Ads) are stored **encrypted in Postgres** via Settings UI — not as GitHub secrets.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | API + Web watch |
| `pnpm test` | Package tests (CMB golden) |
| `pnpm typecheck` | Strict TS |
| `pnpm docker:up` | Full compose |

## Feature status

See parent deliverable notes after push — modules ship as working vertical slices; external providers are **key-gated** (live when key validates, otherwise clear UI disable / stub with confirm gates).
