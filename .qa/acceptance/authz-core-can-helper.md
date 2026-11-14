# Acceptance — authz-core-can-helper

## Intent

Add a typed permission catalog with scopes and a central `can(actor, key, context?)` helper on top of existing bundles — foundation for Epic C/D. No second role engine; no mass route rewrite.

## Happy Path

Given a membership with `finance.read`, `can(actor, 'finance.read')` allows. Without the key, deny. Unknown keys deny. With project context and `projects.read`, allow only when scope (owner/member/company visibility) matches. Owners still pass key checks (documented); sensitive keys are marked in the catalog.

## Security Coverage

- B-08 deny-by-default for unknown keys via `can()`
- B-09 identity only via caller-supplied MembershipAuthz (session-derived upstream)
- B-02 foundation for route adoption in #18

## Launch Checklist (SC)

N/A — not a launch ticket (foundation only).

## Implementation Notes

- Added `packages/shared/src/authz.ts`: `PERMISSION_CATALOG`, `can` / `assertCan`, scopes
- API re-exports via `authorize.ts` `can` / `assertCan` with optional `userId` + resource ctx
- SECURITY.md documents scope model + owner/sensitive policy
- Unit tests: 10 in `authz.test.ts`; composition gate SKIPPED (library-only)
