# Feature: refactor: split api customers routes into service

## Intent
Same module template as projects: thin routes + service for customers to remove the second God-file.

## Happy Path
- [x] customers/routes.ts is HTTP entry; domain helpers live in service.ts; optional note/engagement route files for size
- [x] No intentional HTTP contract change (paths, status codes, payload shapes)
- [x] `pnpm run checks` passes
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout)

## Edge Cases
- [x] Notes, consents, purchases, events, tags stay identical (mechanical move)
- [x] index import `customerRoutes` unchanged

## Non-Goals
- No CRM product behavior changes
- No web rename customer→customers
- No schema split

## Secure-by-Default Coverage
- B-02/B-03: membership + `canMutateContent` checks remain in HTTP handlers before DB work
- No new client identity trust (B-09 N/A — unchanged)
- F-03/F-05 N/A — API-only refactor
- B-04: drizzle query builder preserved (no string SQL with user input beyond existing `ilike`/`jsonb` patterns)

## Launch Checklist (SC)
N/A — not a launch ticket; inline SC-01/02/03/06: authz preserved on mutating routes

## Composition Gate
- SKIPPED — API structure refactor; no UI hops (proof: `.qa/runs/composition-gate-arch-customers-service-split.md`)

## Implementation Notes
```
modules/customers/
  routes.ts              # entry — wires register*
  service.ts             # mappers, loaders, events, stats
  customerCrudRoutes.ts  # list/detail/CRUD + archive/restore
  noteRoutes.ts          # notes HTTP
  engagementRoutes.ts    # stats, purchases, consents, communication
```
