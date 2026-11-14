<!-- contract-status: binding -->
<!-- scope: repo -->
<!-- authoritative-sources: AGENTS.md, DECISIONS.md, apps/*, packages/* -->
<!-- last-confirmed: 2026-11-05 (owner approved sharpening target) -->

# Architecture — Business Ultra 2

> Binding project architecture contract. Derived from `AGENTS.md`, `DECISIONS.md`, and the codebase.
> Items marked **UNRESOLVED** remain open work, not approved inventions.

## Style and rationale

| | |
|---|---|
| **Chosen style** | **Modular monolith** (binding in AGENTS / DECISIONS) |
| **Why** | Single deployable product with clear module ownership; shared Postgres; Integration Core as shared kernel for providers |
| **Not** | Microservices; Next.js/Vercel-only; Supabase-as-backend (locked out by DECISIONS) |
| **Not (sharpening)** | SagaTree-style `domains/` + `infrastructure/` + `app/<slice>/` frontend layers; no CI import graph that forbids `components/` |

### Ist vs Soll vs Target

| Concern | Ist (code) | Soll (binding) | Target |
|---------|------------|----------------|--------|
| Shape | pnpm monorepo: web + api + packages + sidecars | Modular monolith | same |
| API modules | Mostly single fat `routes.ts` per module | `routes.ts` (HTTP) + `service.ts` (DB/rules) | Fat modules split; thin HTTP |
| Persistence schema | One `db/schema.ts` | Ownership files under `db/schema/` + stable barrel | Split without table renames |
| Web features | `features/customer`, `features/product`, some UI in `components/product` | Feature folders match API module names (`customers`, `products`); `components/` = shared-only | Naming sync + colocation |
| Persistence | Postgres 16 + Drizzle | Postgres + local volumes | same — no active stack migration |
| Tenancy | `/co/:slug` UI, `/api/b/:slug` API | Business as auth root | same |
| Integrations | Provider → Connection → Binding (+ credentials, sync, outbox) | Integration Core (DECISIONS) | expand adapters per Inbox build order |

## System context

| Runtime | Role | Default local |
|---------|------|----------------|
| `apps/web` | Dark-Ops SPA (Vite/React) | `:8741` |
| `apps/api` | Fastify API + Drizzle | `:8742` |
| Postgres 16 | System of record | Docker `:5432` |
| `services/sortanize` | FastAPI lead-matching sidecar | `:8760` |
| `openseo/` | Pinned OpenSEO image + SSO stubs | digest-pinned |
| Playwright `apps/e2e` | Core acceptance | — |

Frontend routing map: [ROUTING.md](./ROUTING.md).

## Module template (Soll)

### API — `apps/api/src/modules/<name>/`

```
routes.ts     # register Fastify routes; parse/validate; call service; map errors/status
service.ts    # DB + domain orchestration (may split helpers when large: tasks.ts, …)
```

Rules:

- Prefer route files **under ~300 lines**; put DB and product rules in service/helpers
- Do **not** change HTTP paths, status codes, or payload shapes as part of structure-only refactors
- AuthZ stays at the route/plugin boundary (membership by slug); services receive already-authorized `businessId` / actor context — never trust client-supplied user id / roles / tenant id

### Web — `apps/web/src/`

```
features/<api-module-name>/   # e.g. customers, products, projects (match API)
components/                   # shared shell, notes, CRM filters — not feature-private screens
lib/                          # API client, paths
```

Rules:

- Feature-private UI lives under that feature, not under `components/<feature>/`
- Truly cross-feature UI (e.g. notes used by customers + projects) stays in `components/`

### Schema — `apps/api/src/db/`

Target layout (no table renames, no behavior change):

```
schema/
  identity.ts      # Better Auth + users, businesses, memberships, bundles, grants, …
  crm.ts           # customers, tags, notes, …
  projects.ts
  inbox.ts
  integrations.ts
  marketing.ts
  tools.ts         # tool_installs, personas, cmb, openseo, …
  index.ts         # re-export
schema.ts          # stable barrel re-export (keep import path `db/schema`)
```

### Explicit anti-goals

- No microservices split
- No copy of SagaTree #94 (`src/domains/**`, eradicated `components/`, vertical `app/<area>/<slice>`)
- No weakening of tenancy, session AuthN, or Integration Core decisions

## Modules and boundaries

| Area | Location | Responsibility | Notes |
|------|----------|----------------|-------|
| Web shell / features | `apps/web/src/features/*`, `components/*` | UI only; talks via API client / shared Zod | No SQL in frontend (**AGENTS**) |
| API modules | `apps/api/src/modules/*` | HTTP + service per domain | Tenant via membership + slug |
| Integration Core | `apps/api/src/lib/integrations/core/*` | Providers, connections, credentials, bindings, capabilities, adapters | Shared; modules own domain tables |
| OAuth / adapters | `apps/api/src/lib/integrations/{oauth,gmail,telegram,unipile,…}` | Provider-specific I/O | DECISIONS Integration Core |
| Shared contracts | `packages/shared` | Zod schemas, permission catalog + AuthZ helpers | Single public contract surface for UI↔API |
| Finance SoR | `apps/api/src/modules/finance` + `db/schema/finance.ts` | Accounts, transactions, settings, snapshot API | UI under `features/finance`; finAPI sync later |
| Demo seed | `apps/api/src/db/seedDemo.ts` + `db/demo/*` | Local replace seed (`BU2_DEMO_SEED=1`) | Three DE firms S/M/L; never prod |
| Finance / CMB | `packages/finance-calc` | Pricing/CMB engine + goldens | Internal package |
| Auth plugin | `apps/api/src/plugins/auth.ts` | Better Auth session → user; membership by slug | Identity never from client headers |
| AuthZ resolver | `apps/api/src/lib/authorize.ts` + `packages/shared/permissions` | `is_owner` OR permission bundles; platform grants | Deny by default; no content superuser |
| Persistence | `apps/api/src/db/*` | Schema, migrate, seed, client | Drizzle |

## Data ownership (Ist — schema-derived)

Approximate ownership by table group in `apps/api/src/db/schema.ts`:

| Owner concern | Tables (examples) |
|---------------|-------------------|
| Identity / tenancy | Better Auth `user`/`session`/`account`/`verification`; BU2 `users`, `businesses`, `memberships`, `invites`, `platform_grants`, `permission_bundles`, `bundle_permissions`, `membership_bundles` |
| Settings secrets (single-key gates) | `settings_secrets` |
| Integration Core | `connections`, `connection_credentials`, `module_bindings`, `sync_cursors`, `outbox_jobs`, `business_integrations` |
| Inbox / CRM identity | `contact_identities`, `conversations`, `messages` |
| CRM | `customers`, `customer_*`, `business_tags` |
| Product / catalog | `products`, `catalog_products` |
| Projects | `projects`, `tasks`, `task_*`, `recurrence_rules`, `task_occurrences`, `project_events` |
| Marketing / ads | `social_drafts`, `ads_campaigns`, `funnel_bindings`, `brevo_campaigns` |
| Finance | `finance_accounts`, `finance_transactions`, `finance_settings` |
| Tools | `tool_installs`, `personas`, `cmb_*`, `openseo_*` |
| Audit | `audit_log` |

**UNRESOLVED:** formal “only this module may write table X” enforcement (optional later; not required for sharpening).

## Allowed / forbidden dependencies

**Allowed**

- `apps/web` → `@bu2/shared`, API HTTP client
- `apps/api` modules → `db`, `lib/*`, `@bu2/shared`, `@bu2/finance-calc` as needed
- Integration adapters → Core types + provider SDKs/HTTP

**Forbidden (Soll from AGENTS)**

- SQL / Drizzle from `apps/web`
- Trusting client-supplied user id / roles / tenant id (slug is routing; membership resolved server-side)
- New UI design systems (shadcn/Material/DaisyUI mandate) without a decision
- Secrets in client bundle

## Domain vs infrastructure

- **Domain / product rules:** shared Zod + module services/routes; CMB in `finance-calc`
- **Infrastructure:** Postgres, cookies/sessions, encrypted credentials, OAuth, outbox, Docker sidecars

## AuthN / AuthZ boundaries

See [SECURITY.md](./SECURITY.md). Summary (binding via DECISIONS Auth Bundles + AGENTS Secure-by-Default):

- **AuthN:** Better Auth (email/password + magic link + email OTP); open signup disabled; session via Better Auth cookie; `plugins/auth.ts` maps session → BU2 `users` profile
- **AuthZ (company):** `memberships.is_owner` **or** union of assigned permission bundles (`packages/shared` + `lib/authorize.ts`); deny unknown keys
- **Platform:** `companies.create` via `platform_grants` (not a company bundle); bootstrap grants first installer
- **Operators:** `isSuperadmin` / `isBreakglassOperator` are infra/admin only — **not** content superusers and must not bypass company membership AuthZ
- **Tenant API:** `/api/b/:slug/...` loads membership server-side for that business. Never take identity from client headers (B-09).

## Shared code rules

- Prefer `@bu2/shared` contracts over duplicated types
- Reuse Dark-Ops shell / existing feature components before one-offs ([UI_STYLEGUIDE.md](./UI_STYLEGUIDE.md))
- Integration Core for multi-account connections; `settings_secrets` only for single API-key feature gates (DECISIONS)

## External providers

Canonical detail: [INTEGRATIONS.md](./INTEGRATIONS.md).

## Exceptions

Document approved exceptions in [DECISIONS.md](../DECISIONS.md). Do not weaken tenancy or secret handling without a new decision.

## Checks

| Check | Command / location | Status |
|-------|--------------------|--------|
| Lint + typecheck + web build | `pnpm run checks` | project gate |
| E2E | `pnpm test:e2e` | project gate |
| Architecture boundary script | `scripts/check-boundaries.sh` (via `pnpm run checks`) | enforces: no Drizzle/SQL/`apps/api`/db imports in `apps/web` |

## Open items

- [x] Executable import-boundary checks in `pnpm run checks` (web must not import Drizzle/SQL/api db)
- [x] Apply module template to fat API modules (projects, customers, …)
- [x] Schema ownership file split (stable barrel)
- [x] Web feature naming sync (`customers` / `products`)
- [ ] Per-module public API list beyond route folders
- [ ] Optional: per-table write ownership enforcement (warn-only)
