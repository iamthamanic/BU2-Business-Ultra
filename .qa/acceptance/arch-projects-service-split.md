# Feature: refactor: split api projects routes into service

## Intent
Make the projects API navigable by extracting domain helpers into service.ts and splitting HTTP registration by subdomain (projects / tasks / recurrence) without changing HTTP behavior.

## Happy Path
- [x] projects/routes.ts is HTTP entry; domain helpers live in service.ts; optional task/recurrence route files for size
- [x] No intentional HTTP contract change (paths, status codes, payload shapes)
- [x] `pnpm run checks` passes (or pre-existing failures only outside projects)
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout)

## Edge Cases
- [x] Recurrence, tasks, attachments, events code paths preserved by mechanical move
- [x] index import `projectRoutes` unchanged

## Secure-by-Default Coverage
- B-02/B-03: membership checks remain in HTTP handlers before DB work
- No new client identity trust

## Composition Gate
- SKIPPED — API structure refactor; no UI hops

## Implementation Notes
```
modules/projects/
  routes.ts            # entry — wires register* 
  service.ts           # mappers, access, loaders, materialize, stats
  projectRoutes.ts     # project CRUD + activity HTTP
  taskRoutes.ts        # tasks + attachments HTTP
  recurrenceRoutes.ts  # recurrence HTTP
  defaultAreas.ts
```
