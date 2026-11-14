# Audit Changes — oauth-ads-social

- Date: 2026-11-14
- Scope: uncommitted (OAuth ads + social workers focus; large dirty tree)
- Depth: standard
- Verdict: **WARN**

## Phase A — Test Gate

## Test Gate — PASS

- Depth: standard
- Profile: monorepo (config)
- Scope: both
- checksCommand: `pnpm run checks` → exit 0

| Check | Command / probe | Exit | Result |
|-------|-----------------|------|--------|
| checks | `pnpm run checks` | 0 | PASS |
| oauth unit | `vitest run src/lib/integrations/oauth/` | 0 | PASS (11) |
| typed-strict | rg any/@ts-ignore on oauth/social touch | 0 | PASS |
| secureByDefault | RG secrets/localStorage/B-10 | — | PASS (no critical hits in settings; UNIPILE `\|\| ''` pre-existing fail-empty) |

## Phase B — Security

- `@security-review` → WARN (no BLOCK)
- `@security-auditor` → Important items; Critical IDOR absent
- Fixed in-session: account-id identity (chatgpt/microsoft_ads), oauth error_description scrub, publish error detail sanitize

Open WARN: in-memory PKCE, OAuth rate limits, Meta/IG query-string tokens, public redirect-uris, ads secrets dual path

## Phase C — Review lite

- SOLID/KISS: social sync/publish modules thin; adsKey retired to no-op — OK
- DRY: shared `jwtPayloadClaims` for stable ids
- Ponytail: large pre-existing finance/inbox churn outside this slice — note only

## Phase D

- AgentShield: SKIPPED (`.cursor/` not in app scope)
- verify-ui: not requested

## Next

- `@ecc-check` before PR/ship
