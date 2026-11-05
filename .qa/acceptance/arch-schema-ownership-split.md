# Feature: split drizzle schema by ownership

## Happy Path
- [x] Tables grouped into ownership files under db/schema/
- [x] Public import surface remains `db/schema` barrel
- [x] `pnpm run checks` passes
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout)

## Composition Gate
- SKIPPED — schema move only; no UI hops

## Implementation Notes
identity, crm, projects, inbox, integrations, marketing, tools + index; schema.ts re-exports.
