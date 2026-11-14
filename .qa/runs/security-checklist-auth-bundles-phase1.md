# Security Checklist — auth-bundles-phase1 (diff mode)

- Date: 2026-11-11
- HEAD_SHA: see `git rev-parse HEAD` at write time
- Mode: **diff** (API/auth/session)

| ID | Result | Evidence |
|----|--------|----------|
| SC-01 | PASS | Membership by slug server-side; `isSuperadmin` content bypass removed; platform grant for company create |
| SC-02 | PASS | Permissions from bundles/DB; client cannot set roles; Zod on invites/bundles |
| SC-03 | PASS | Auth routes `config.rateLimit` (login/challenge/session) |
| SC-04 | PARTIAL | Lockfile present; no full `pnpm audit` this run |
| SC-06 | PASS | No secrets in client; SESSION_SECRET fail-closed in prod; RG clean |

Verdict: **PASS** for diff-critical (SC-01/02/06). SC-04 informational PARTIAL.
