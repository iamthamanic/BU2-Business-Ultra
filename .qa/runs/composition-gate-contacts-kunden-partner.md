# Composition Gate — contacts-kunden-partner

- HEAD_SHA: WORKTREE (uncommitted; base HEAD `216ddc7c8219e06c5fbcc4738a645474ce5d4486`)
- Date: 2026-11-08
- Verdict: CLEAR

## Event
User creates or lists a CRM contact with role customer and/or partner under a business tenant.

## Hop chain
UI Kontakte tabs → `GET/POST/PATCH /api/b/:slug/customers` (+ list alias `/contacts`) → Zod CustomerSchema → Drizzle `contacts` (ex-`customers`) scoped by `businessId` → `toCustomer` DTO → list/detail UI

## Simulations
| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| 1 create partner-only | 1 row, isPartner, P-number, not in role=customer list | Same; verified UI create → detail `P-100100` | pass |
| invalid both roles false | fail closed 400 / zod | schema + route reject | pass |
| 2 tenants | no cross-business rows | loadMembership + eq(businessId) on all queries | pass |

## Flags
| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| — | — | — | — | n/a |

## Skip reason
n/a

## Re-verify 2026-11-08 (follow-up fixes)
- Still WORKTREE; hop meaning unchanged → CLEAR
- Dual-role + archive/restore verified (Ada Kunde in both role lists; archive hides/restores)
- Create-modal tab defaults fixed (`key={tab}` + full reset on open)
- e2e `apps/e2e/tests/contacts-kunden-partner.spec.ts` PASS (API + UI)
