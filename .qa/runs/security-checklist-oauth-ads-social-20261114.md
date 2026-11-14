# Security Checklist — oauth-ads-social

- **Date:** 2026-11-14
- **Mode:** diff
- **HEAD SHA:** WORKTREE (base 1b3353dac620de1e80277d95b16aa429d691985c)
- **Stack notes:** Vite/React + Fastify OAuth Integration Core
- **Verdict:** PASS

## Summary

| ID | Gate | Result | Severity | Notes |
|----|------|--------|----------|-------|
| SC-01 | Authorization / IDOR | PASS | Critical | businessId-scoped connections; OAuth session↔state |
| SC-02 | Never trust the client | PASS | Critical | Zod provider enum; tenant from membership |
| SC-03 | Rate limiting | PASS | Important | OAuth start 20/min, callback 40/min, redirect-uris 30/min |
| SC-04 | Supply chain | PASS | Important | `pnpm run checks` exit 0 |
| SC-05 | Logging & monitoring | PARTIAL | Minor (diff) | Diff mode; launch follow-up |
| SC-06 | Secrets | PASS | Critical | PKCE cookie sealed; ads secrets 410; Bearer for Meta/IG me |
| SC-07 | Backups | N/A | — | Diff mode |

## Findings to fix

(none Critical/Important open after WARN fix pass)

## Secure-by-Default cross-ref

- B-02, B-03, B-09, B-10, F-03, F-05, P-02, P-05, P-06 addressed in WARN fix pass
- `@security-review` / `@security-auditor` prior WARN items closed or tracked as ops hygiene (oauth `code` in GET is IdP standard)
