# Verify UI — auth-bundles-phase1

- Date: 2026-11-11
- Spec: `apps/e2e/tests/auth-bundles-ui.spec.ts`
- Verdict: **PASS** (with note)
- Dev servers: reuseExisting (`E2E_NO_SERVER=1`)

## Preconditions fixed in-session

Local DB had BU2 `users` but empty Better Auth `user`/`account` → login 401.
Fixed via `apps/api/src/db/seed.ts` (upsert credential + platform grant). Re-seeded bootstrap owner.

## Evidence

| Step | File | Result |
|------|------|--------|
| Setup | `.qa/evidence/auth-bundles-phase1/01-setup-skipped-login.png` | SKIPPED runtime — `setup/status.required=false`; captured login |
| Login | `02-login-password.png` | PASS — BrandMark + Zugangsdaten form |
| Company shell | `03-company-switcher-create.png` | PASS — `/co/business-ultra` shell |
| Team / Bundles | `04-team-bundles.png` | PASS — Settings → Team, invite + Berechtigungs-Bundles |

## Playwright

```
1 passed (auth-bundles-ui.spec.ts)
```

## Notes

- `BOOTSTRAP_OWNER_PASSWORD` in `.env.local` is &lt; 8 chars; seed falls back to `change-me-local` for Better Auth (min length). Update `.env.local` when convenient.
- Full CustomerDetail/Inbox shrink not done this pass (high risk); dead `grant*` i18n removed; `BundlesEditor` extracted.
