<!-- contract-status: binding -->
<!-- scope: security -->
<!-- authoritative-sources: AGENTS.md Security Checklist, DECISIONS.md, apps/api/src/plugins/auth.ts, packages/shared roles -->
<!-- last-confirmed: 2026-11-04 (owner approved) -->

# Security — Business Ultra 2

> Binding security contract for multi-tenant BU2 (owner-approved 2026-11-04).
> Agent Secure-by-Default checklist in `AGENTS.md` remains the implementation gate table.
> Items marked **UNRESOLVED** are gaps to close, not waived controls.

## Authentication

| Topic | Ist / Soll |
|-------|------------|
| Primary | Email + password (local seed via `BOOTSTRAP_OWNER_*`) |
| Secondary / dev | Magic link / OTP (Brevo when keyed; otherwise console in non-prod) |
| Session | HttpOnly cookie `bu2_session`; server stores token **hash** (`sessions.tokenHash`) |
| Identity load | `apps/api/src/plugins/auth.ts` — cookie → session → user |
| Password change | `POST /api/auth/password` with current + new password |
| Rate limit (P-05) | `@fastify/rate-limit` registered with `global: false`; auth routes set `config.rateLimit` (login/password 20/min, magic/OTP/verify 10/min, me/logout 60/min) |

**Fail closed:** no default session secrets in production env loading (see README / `.env.example`).

## Authorization / roles

Roles (`packages/shared`): `owner` | `admin` | `editor` | `viewer`.

Helpers (examples): `canManageMembers`, `canSendMail`, `canManageCredentials`, `canMutateContent`, `canOpenSeo`.

| Rule | Source |
|------|--------|
| Invite-only tenancy | DECISIONS |
| `mail.send` Owner/Admin only | DECISIONS 16A |
| Last owner cannot leave without transfer | DECISIONS / PRD notes |
| Superadmin UI / breakglass operator ≠ content superuser | DECISIONS 11A / 17B |
| OpenSEO `seo.open` grant scoped | DECISIONS precedence |

Route handlers must call `requireUser` / membership load / role helpers — **B-02**.

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

Volume `bu2_uploads` (see backup runbook). Postgres dumps do not include uploads. Validation rules: follow Secure-by-Default **P-04**; details **UNRESOLVED** if endpoint-specific limits are not yet centralized.

## External API trust

Adapters treat provider responses as untrusted input; credentials stay server-side. See [INTEGRATIONS.md](./INTEGRATIONS.md).

## Invariants

1. Tenant slug from route + server membership — not client-claimed role.
2. Secrets fail-closed — no `process.env.SECRET || 'default-…'` in prod paths (**B-10**).
3. State-changing browser calls need CSRF / SameSite cookie discipline (**F-04**).
4. Auth endpoints rate-limited (**P-05**) — Ist: `@fastify/rate-limit` on `/api/auth/*` (see table above).
5. Outbox / sync jobs must be idempotent / claim-safe (**P-06**).

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
