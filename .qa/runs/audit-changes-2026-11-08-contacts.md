# Audit Changes — contacts + related WIP

- Date: 2026-11-08
- Scope: uncommitted WORKTREE (contacts feature + prior connections/inbox WIP on same branch)
- Depth: standard
- Verdict: **WARN** (CLEAN for contacts core after fixes; WARN for mixed WIP scope)

## Phase A — Test Gate
PASS — see chat report (`pnpm run checks` 0, contacts unit 4/4)

## Phase B — Security
- Secrets RG: clean (`.env.example` placeholders only)
- B-10 hits on `GOOGLE_ADS_DEVELOPER_TOKEN \|\| ''` are **presence checks**, not secret defaults → note only
- AuthZ: membership + `canMutateContent` on mutations
- Tenant: `businessId` filters preserved
- F-03 localStorage tokens: clean (tab preference only)

## Phase C — Review lite
- Create modal role defaults: **fixed** (useEffect on open)
- Partner-only LTV / „Kunde seit“: **fixed** (hide when !isCustomer)
- Scope creep: finance/inbox/connections files in same tree — separate from contacts AC

## Next
Run `@ecc-check` before PR/ship.
