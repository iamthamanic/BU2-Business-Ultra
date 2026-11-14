# Acceptance — security-launch-blockers

## Intent

Close confirmed Critical/Important launch blockers from the 2026-11-14 full-codebase security audit without building the full granular AuthZ editor yet.

## Happy Path

Given an authenticated company member, when they request a logo/inbox/product/task file under their business, the API streams the file. Given an anonymous client or foreign tenant, the same path returns 401/403. OpenSEO SSO refuses to boot/handle without a non-default secret. Invites cannot assign bundles whose effective keys exceed the inviter’s grant-subset; accept re-checks. Outbox send claims are atomic. API responses for 5xx omit internal messages. Helmet headers and baseline rate limits are active. CI runs a dependency audit gate.

## Preconditions

- HEAD based on main post `72f27c4`
- Existing upload disk layout `{UPLOADS_DIR}/{businessId}/...`

## Scope

In: API media auth, env fail-closed, invites, outbox claim, helmet, rate-limit, error handler, CI audit, docs SECURITY/OPERATIONS notes  
Out: Permission editor UI, module fine-read rollout, HR, department model

## Security Coverage

- SC-01 / B-02 / B-03: authenticated media; path confined to businessId
- SC-02 / B-07: invite + accept grant-subset
- SC-03 / B-06 / P-05: global + auth limits
- SC-06 / B-10: OpenSEO secret fail-closed
- B-05: helmet
- P-01: CI audit
- P-02: generic 5xx
- P-06: atomic outbox claim
- F-03/F-05: N/A (no client secrets)

## Launch Checklist (SC)

SC-01, SC-02, SC-03, SC-06 in scope. SC-04 partial via CI audit (may still flag transitive zod/vitest until follow-up). SC-05/SC-07 documented as external/ops PARTIAL — no fake pass.

## Edge Cases

- Path traversal `../` in media URL → 400/403
- Legacy `/uploads/...` paths still work only when authenticated (compat)
- Invite with foreign bundleId → 403
- Inviter loses rights before accept → accept rejects or strips

## Implementation Notes

- Removed `@fastify/static`; added `mediaRoutes` + path confinement (`mediaPaths.ts`)
- `OPENSEO_SSO_SHARED_SECRET` required; prod rejects placeholders; rotate note in SECURITY.md
- Invites + accept: `assertBundlesAssignable`
- Helmet, global rate limit 300/min, generic 5xx, atomic outbox claim
- CI: `pnpm audit --audit-level=critical` + assert no `@fastify/static`
- Residual: zod@3 High (DoS on oversized input) → #20 / Zod 4 uplift; SC-05/SC-07 ops still PARTIAL
