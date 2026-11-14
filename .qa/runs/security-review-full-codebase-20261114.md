# Security Review — full codebase (Secure-by-Default + OWASP)

- **Date:** 2026-11-14
- **HEAD:** 72f27c43ab5fc89bf1aec971bade4f36feb2bfbe (`main` post PR #15)
- **Verdict:** **CHANGES_REQUESTED**
- **Auditor:** [security-auditor](de2821aa-1758-4d07-89a6-1420f90bf1bd) + [security-review](5125fc49-d55a-4ebf-8950-288146d3504c)

## Checklist matrix

### Frontend

| ID | Result | Notes |
|----|--------|-------|
| F-01 | PASS* | HTTPS in prod templates; TLS at proxy |
| F-02 | PASS | Zod + HTML sanitize on notes/email |
| F-03 | PASS | No session tokens in localStorage |
| F-04 | PASS | HttpOnly + SameSite=Lax (+ Secure prod) |
| F-05 | PASS | Only `VITE_API_URL` in client |

### Backend

| ID | Result | Notes |
|----|--------|-------|
| B-01 | PASS | Better Auth, bcrypt, signup disabled |
| B-02 | PASS* | Mutations gated; reads weaker |
| B-03 | PASS* | Tenant routes auth’d; `/uploads/` + cmb simulate public |
| B-04 | PASS | Drizzle / bound params |
| B-05 | FAIL | No helmet / security headers |
| B-06 | FAIL | Rate limit not global; API unlimited |
| B-07 | FAIL | Invites skip grant-subset |
| B-08 | FAIL | Most GETs membership-only (finance is good counterexample) |
| B-09 | PASS | Session-derived identity only |
| B-10 | FAIL | `OPENSEO_SSO_SHARED_SECRET` Zod default |

### Practical

| ID | Result | Notes |
|----|--------|-------|
| P-01 | FAIL | Audit highs/criticals; no CI audit |
| P-02 | PASS* | No stack to client; raw `e.message` still leaked |
| P-03 | PASS | Secure cookie flags in prod |
| P-04 | PASS* | Size/type checks uneven; 256MB multipart |
| P-05 | PASS | Auth endpoints limited |
| P-06 | FAIL | Outbox non-atomic claim |

## RG probes

| Probe | Result |
|-------|--------|
| localStorage token/secret | Clean |
| VITE_* secrets | Clean |
| B-09 client identity headers | Clean |
| B-04 SQL concat | Clean |
| B-10 `process.env.SECRET \|\|` | Optional Unipile `\|\| ''` only; OpenSEO via Zod `.default()` |

## Ship blockers

1. Authenticate or remove public `/uploads/`
2. Fail-closed OpenSEO SSO secret; rotate if ever defaulted in prod
3. Patch/remove vulnerable `@fastify/static` exposure
4. `assertGrantSubset` on invites
5. Helmet (or proxy-enforced headers) + tiered API rate limits
6. CI dependency audit gate
7. Atomic outbox claim (multi-worker)

## Positive controls

- Slug → server `loadMembership`; superadmin no content bypass on `/api/b/:slug`
- Finance `finance.read` / `finance.write`
- Bundle assign grant-subset + AES-GCM sealed credentials
- Auth/OAuth rate limits; PKCE OAuth cookie
- Backup scripts + encrypted dump runbook exist
