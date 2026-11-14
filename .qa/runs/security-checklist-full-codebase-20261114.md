# Security Checklist — business-ultra (full codebase)

- **Date:** 2026-11-14
- **Mode:** audit
- **HEAD SHA:** 72f27c43ab5fc89bf1aec971bade4f36feb2bfbe
- **Stack notes:** Vite/React SPA + Fastify/Drizzle/Postgres; Better Auth; multi-tenant `/api/b/:slug`
- **Verdict:** FAIL
- **Companions:** `@security-review` CHANGES_REQUESTED; [security-auditor](de2821aa-1758-4d07-89a6-1420f90bf1bd) elevated risk

## Summary

| ID | Gate | Result | Severity | Notes |
|----|------|--------|----------|-------|
| SC-01 | Authorization / IDOR | FAIL | Critical | Tenant API membership OK; **`/uploads/` unauthenticated**; invite B-07; coarse reads |
| SC-02 | Never trust the client | PARTIAL | Critical | Zod allowlists widely; invite `bundleIds` without grant-subset |
| SC-03 | Rate limiting | FAIL | Important | Auth + OAuth only; `global: false` |
| SC-04 | Supply chain | FAIL | Important | Lockfile yes; `pnpm audit` 3 crit / 3 high; no Dependabot / CI audit |
| SC-05 | Logging & monitoring | PARTIAL | Important | Fastify logger; **no** Sentry/abuse alert (OPERATIONS UNRESOLVED) |
| SC-06 | Secrets | FAIL | Critical | `OPENSEO_SSO_SHARED_SECRET` Zod default ships in prod if unset |
| SC-07 | Backups & recovery | PARTIAL | Important | Scripts + runbook; quarterly checklist unchecked; rollback UNRESOLVED |

## Evidence

### SC-01
- Test performed: Code review of `loadMembership` + public static; no live two-tenant curl (no prod creds).
- Result: **FAIL** — `apps/api/src/index.ts:63-67` serves `UPLOADS_DIR` at `/uploads/` without auth. Writers store inbox/logos/products/tasks under guessable UUID paths. Cross-tenant `/api/b/:slug` generally requires membership (PASS for that surface). CRM/inbox GETs = any member (product soften of deny-by-default).

### SC-02
- Test performed: Sampled Zod parse on finance/settings/invites; body privilege fields.
- Result: **PARTIAL** — schemas whitelist most fields; `POST /api/b/:slug/invites` accepts `bundleIds` without `assertGrantSubset` (`business/routes.ts:115-132`) vs correct path in `bundleRoutes.ts`.

### SC-03
- Test performed: RG `@fastify/rate-limit` + route `config.rateLimit`.
- Result: **FAIL** — registered `global: false` (`index.ts:55-60`); limits only auth (`auth/routes.ts`) and OAuth (`oauthRoutes.ts`). Brevo send / inbox sync / sortanize / uploads unbounded.

### SC-04
- Test performed: `pnpm audit --audit-level=high`; lockfile present; CI workflow check.
- Result: **FAIL** — `pnpm-lock.yaml` committed; audit: **3 critical / 3 high / 16 moderate** (incl. `@fastify/static`, zod memory, vitest/vite via better-auth). No `.github/dependabot.yml`; CI has no audit gate.

### SC-05
- Test performed: Docs + code for Sentry/alerts; `logger: true` on Fastify.
- Result: **PARTIAL** — local logging exists; `docs/OPERATIONS.md` Monitoring **UNRESOLVED**; no failed-login spike alert.

### SC-06
- Test performed: RG B-10 / VITE_ / localStorage; read `env.ts`.
- Result: **FAIL** — `OPENSEO_SSO_SHARED_SECRET` default `'change-me-openseo-sso-secret'` (`env.ts:30`) applies even when `NODE_ENV=production` if unset. SESSION/SECRETS_MASTER fail-closed in prod (good). Client: no token localStorage; only `VITE_API_URL`. `.env*` gitignored.

### SC-07
- Test performed: `docs/BACKUP_RUNBOOK.md`, `scripts/backup.sh`, `scripts/restore.sh`, OPERATIONS.
- Result: **PARTIAL** — encrypted dump path documented (RPO≤24h / RTO≤8h); quarterly verification checklist **unchecked** (no dated rehearsal evidence); app rollback procedure **UNRESOLVED**.

## Findings to fix

| ID | Issue | Action |
|----|-------|--------|
| SC-01 / SEC-001 | Public `/uploads/` | Authz download routes or signed URLs; stop static public mount for private blobs |
| SC-06 / SEC-002 | OpenSEO SSO default secret | Remove Zod default; fail closed in prod; rotate if ever deployed |
| SC-04 / SEC-003 | Vulnerable `@fastify/static` | Upgrade patched version **and** remove private static exposure |
| SC-02 / B-07 | Invite bundle privilege escalation | `assertGrantSubset` on invite `bundleIds` |
| SC-01 / B-08 | Membership-only reads | Enforce `*.read` keys or document “member = full read” as product decision |
| SC-03 | Abuse/cost endpoints unlimited | Rate-limit Brevo send, sync, AI/sidecar, large uploads |
| P-06 | Outbox TOCTOU | Atomic claim `UPDATE … WHERE status='pending'` |
| SC-04 | Audit / Dependabot | CI `pnpm audit` High+ gate; enable Dependabot/Renovate |
| B-05 | No helmet | `@fastify/helmet` or binding reverse-proxy headers |
| SC-05 | No abuse alerts | Error drain + ≥1 auth-abuse alert |
| SC-07 | Restore rehearsal | Date one restore dry-run; document rollback artifact |

## Out of scope / N/A

- Live IDOR curl against production tenants — no prod credentials in this audit (marked as code-evidence FAIL where clear).
- Blockchain / Solana — N/A for BU2.

## Secure-by-Default cross-ref

- Related F/B/P: **B-05 FAIL, B-06 FAIL, B-07 FAIL (invites), B-08 FAIL (reads), B-10 FAIL (OpenSEO), P-01 FAIL, P-06 FAIL**; F-01…F-05 / B-01 / B-04 / B-09 / P-03 / P-05 largely PASS
- `@security-review` also run: **yes** → CHANGES_REQUESTED
- `@security-auditor` also run: **yes** → elevated / Critical paths SEC-001…003

## Next steps

1. Fix Critical: uploads AuthZ, OpenSEO secret fail-closed (+ rotate), static upgrade.
2. Fix Important: invite grant-subset, outbox claim, API rate limits, helmet, error sanitization.
3. Decide B-08 product policy (fine-grained reads vs “any member reads”).
4. Ops: Dependabot + CI audit; Sentry/alerts; dated restore rehearsal.
5. Re-run `/security-checklist` in **launch** mode before first public deploy.
