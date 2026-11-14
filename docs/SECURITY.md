<!-- contract-status: binding -->
<!-- scope: security -->
<!-- authoritative-sources: AGENTS.md Security Checklist, DECISIONS.md, apps/api/src/plugins/auth.ts, packages/shared permissions -->
<!-- last-confirmed: 2026-11-11 (Auth Bundles epic) -->

# Security — Business Ultra 2

> Binding security contract for multi-tenant BU2 (owner-approved 2026-11-04; Auth Bundles update 2026-11-11).
> Agent Secure-by-Default checklist in `AGENTS.md` remains the implementation gate table.
> Items marked **UNRESOLVED** are gaps to close, not waived controls.

## Authentication

| Topic | Ist / Soll |
|-------|------------|
| Primary | Better Auth — email + password; open signup **disabled** |
| Secondary | Magic link + email OTP plugins (Brevo when keyed; otherwise console in non-prod) |
| Bootstrap | Interactive setup (`pnpm setup` / first-run web) creates first user + `companies.create` + first company |
| Session | Better Auth session cookie; `apps/api/src/plugins/auth.ts` loads session → BU2 `users` profile |
| Password change | `POST /api/auth/password` via Better Auth |
| Rate limit (P-05) | `@fastify/rate-limit` registered with `global: false`; auth routes set `config.rateLimit` |

**Fail closed:** no default session secrets in production env loading (see README / `.env.example`).  
`OPENSEO_SSO_SHARED_SECRET` has **no** Zod default — must be set (CI/local inject for non-prod). Production rejects `change-me-*` placeholders. **Rotate** this secret if any environment ever booted with the former default `change-me-openseo-sso-secret`.

## Authorization / permissions

Company AuthZ (`packages/shared/src/permissions.ts`, `packages/shared/src/authz.ts`, `apps/api/src/lib/authorize.ts`):

- `memberships.is_owner` (multi-owner allowed; last-owner protected) **or** union of assigned permission bundles
- Platform capability `companies.create` via `platform_grants` (never a company bundle)
- Deny by default for unknown permission keys
- Helpers: `canManageMembers`, `canSendMail`, `canManageCredentials`, `canMutateContent`, `canOpenSeo`, `canUseTools`, `hasPermission`
- **Central decision API:** `can(actor, permissionKey, resourceContext?)` / `assertCan` — unknown key → deny; then key grant; optional scope check
- **Scopes** (`AUTHZ_SCOPES`): `own` | `assigned` | `project_member` | `explicitly_granted` | `company` — resolved server-side from trusted relations (not from client claims)
- **Catalog:** `PERMISSION_CATALOG` documents module / resource / action / scopes / `sensitive` per key. Sensitive keys (finance, credentials, permission admin, settings.manage) must never be implied by unrelated `*.read`
- **Owner (v1):** owners still pass all catalog keys via `hasPermission` (admin control). Sensitive flags are for UI warnings and future tightening (Epic C+) — not a second role system
- **Department scope:** not implemented until a real org unit model exists (do not reuse Marketing/Kunden/Produkt project areas as departments)

| Rule | Source |
|------|--------|
| Invite-only tenancy | DECISIONS Auth Bundles 2026-11-11 |
| Company create = platform grant | DECISIONS |
| Last owner cannot leave without transfer | DECISIONS / PRD notes |
| Breakglass operator ≠ content superuser | DECISIONS 11A / 17B |
| `isSuperadmin` / breakglass must not bypass company membership AuthZ on `/api/b/:slug` | DECISIONS 11A / 17B (enforced in route handlers) |
| Bundle assign grant-subset (B-07) | Auth Bundles epic |
| `/api/auth/me` exposes `platformCapabilities['companies.create']` for UI affordances | Auth Bundles |

Route handlers must call `requireUser` / `loadMembership` / permission helpers — **B-02**. Admin routes (`/api/admin/*`) remain the only surface for operator flags.

## Tenant / owner isolation

| Surface | Contract |
|---------|----------|
| UI | `/co/:slug/...` — slug is navigation, not trust |
| API | `/api/b/:slug/...` — membership resolved server-side for `businessId` |
| Data | Queries scoped by `businessId` / membership; never trust client business id alone |
| CRM merge | No cross-business contact merge (DECISIONS) |

**B-09:** User id / roles must not come from client headers.

## Data access rules

- Archive preferred over hard delete (Lifecycle decision)
- Uploads: type/size validation required when upload endpoints exist (**P-04**)
- Audit trail table `audit_log` for sensitive actions (extend as features land)

## Secrets

| Kind | Storage |
|------|---------|
| Platform env (OAuth client ids, master keys, Brevo, …) | Host env / GitHub Secrets — names in `.env.example` / `.github/SECRETS.md` |
| Per-business API keys (Metricool, etc.) | Encrypted `settings_secrets` via Settings UI |
| Multi-account tokens | Integration Core `connection_credentials` (encrypted) |
| Client | **Never** embed API keys or session tokens in the SPA bundle (**F-05**, **F-03**) |

No real secrets in git. Docs must not paste credential values.

## Uploads

Private files live under `{UPLOADS_DIR}/{businessId}/…` and are served only via authenticated `GET /api/media/:businessId/*` (legacy `GET /uploads/:businessId/*` uses the same AuthZ). **No** public `@fastify/static` mount. Volume `bu2_uploads` (see backup runbook) is not in Postgres dumps. Validation: Secure-by-Default **P-04**; magic-byte sniffing still **UNRESOLVED**.

## External API trust

Adapters treat provider responses as untrusted input; credentials stay server-side. See [INTEGRATIONS.md](./INTEGRATIONS.md).

## Invariants

1. Tenant slug from route + server membership — not client-claimed role.
2. Secrets fail-closed — no `process.env.SECRET || 'default-…'` in prod paths (**B-10**).
3. State-changing browser calls need CSRF / SameSite cookie discipline (**F-04**).
4. Auth endpoints rate-limited (**P-05**) — Ist: global baseline `@fastify/rate-limit` plus stricter `/api/auth/*` and OAuth configs.
5. Outbox / sync jobs must be idempotent / claim-safe (**P-06**) — Telegram/Unipile outbox uses atomic `UPDATE … WHERE status='pending'`.
6. API security headers via `@fastify/helmet` (CSP for HTML may remain at reverse proxy).

## Negative tests (pointers)

| Area | Where |
|------|-------|
| OAuth exchange / complete | `apps/api/src/lib/integrations/oauth/*.test.ts` |
| Env fail-closed | `apps/api/src/lib/env.test.ts` |
| E2E core auth | `apps/e2e` (Playwright) |

**UNRESOLVED:** dedicated tenant-isolation negative suite checklist in CI.

## Related

- Checklist: `AGENTS.md` → Security Checklist
- Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Ops secrets: `.github/SECRETS.md`
