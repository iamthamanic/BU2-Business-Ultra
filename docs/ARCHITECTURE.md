<!-- contract-status: binding -->
<!-- scope: repo -->
<!-- authoritative-sources: AGENTS.md, DECISIONS.md, apps/*, packages/* -->
<!-- last-confirmed: 2026-11-04 (owner approved) -->

# Architecture — Business Ultra 2

> Binding project architecture contract. Derived from `AGENTS.md`, `DECISIONS.md`, and the codebase; owner-approved 2026-11-04.
> Items marked **UNRESOLVED** remain open work, not approved inventions.

## Style and rationale

| | |
|---|---|
| **Chosen style** | **Modular monolith** (binding intent in AGENTS / DECISIONS) |
| **Why** | Single deployable product with clear module ownership; shared Postgres; Integration Core as shared kernel for providers |
| **Not** | Microservices; Next.js/Vercel-only; Supabase-as-backend (locked out by DECISIONS) |

### Ist vs Soll vs Target

| Concern | Ist (code) | Soll (binding) | Target |
|---------|------------|----------------|--------|
| Shape | pnpm monorepo: web + api + packages + sidecars | Modular monolith | same |
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

## Modules and boundaries

| Area | Location | Responsibility | Notes |
|------|----------|----------------|-------|
| Web shell / features | `apps/web/src/features/*`, `components/*` | UI only; talks via API client / shared Zod | No SQL in frontend (**AGENTS**) |
| API modules | `apps/api/src/modules/*` | HTTP routes per domain (auth, business, customers, projects, inbox, marketing, ads, integrations, …) | Tenant via membership + slug |
| Integration Core | `apps/api/src/lib/integrations/core/*` | Providers catalog, connections, credentials, bindings, capabilities, adapters | Shared; modules own domain tables |
| OAuth / adapters | `apps/api/src/lib/integrations/{oauth,gmail,telegram,unipile,…}` | Provider-specific I/O | See [INTEGRATIONS.md](./INTEGRATIONS.md) |
| Shared contracts | `packages/shared` | Zod schemas, roles, capability helpers | Single public contract surface for UI↔API |
| Finance / CMB | `packages/finance-calc` | Pricing/CMB engine + goldens | Internal package |
| Auth plugin | `apps/api/src/plugins/auth.ts` | Session cookie → user; membership by slug | Identity never from client headers |
| Persistence | `apps/api/src/db/*` | Schema, migrate, seed, client | Drizzle |

## Data ownership (Ist — schema-derived)

Approximate ownership by table group in `apps/api/src/db/schema.ts`:

| Owner concern | Tables (examples) |
|---------------|-------------------|
| Identity / tenancy | `users`, `sessions`, `auth_challenges`, `businesses`, `memberships`, `invites` |
| Settings secrets (single-key gates) | `settings_secrets` |
| Integration Core | `connections`, `connection_credentials`, `module_bindings`, `sync_cursors`, `outbox_jobs`, `business_integrations` |
| Inbox / CRM identity | `contact_identities`, `conversations`, `messages` |
| CRM | `customers`, `customer_*`, `business_tags` |
| Product / catalog | `products`, `catalog_products` |
| Projects | `projects`, `tasks`, `task_*`, `recurrence_rules`, `task_occurrences`, `project_events` |
| Marketing / ads | `social_drafts`, `ads_campaigns`, `funnel_bindings`, `brevo_campaigns` |
| Tools | `checkmap_*`, `personas`, `cmb_*`, `openseo_*` |
| Audit | `audit_log` |

**UNRESOLVED:** formal “only this module may write table X” enforcement (no executable boundary checker yet).

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

See [SECURITY.md](./SECURITY.md). Summary: session cookie `bu2_session`; roles `owner|admin|editor|viewer`; API under `/api/b/:slug/...` loads membership for that business.

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
| Architecture boundary script | `scripts/check-boundaries.sh` (via `pnpm run checks`) | forbids Drizzle/SQL/`apps/api` imports in `apps/web` |

## Open items

- [x] Executable import-boundary checks (`scripts/check-boundaries.sh`)
- [ ] Per-module public API list beyond route folders
