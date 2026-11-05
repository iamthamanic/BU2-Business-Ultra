# Feature: chore: decide modular-monolith sharpening target

<!-- seeded by ecc-runner from issue #1 on 2026-11-05 -->

## Intent
Lock the modular-monolith sharpening target in DECISIONS + ARCHITECTURE so later refactors have a binding contract and explicit anti-goals.

## Happy Path
- [x] DECISIONS.md has a dated decision for modular-monolith sharpening (module template + schema ownership + web feature naming sync)
- [x] docs/ARCHITECTURE.md documents Soll module layout (routes + service) and schema/ ownership split target; marks SagaTree-style domains/ as out of scope
- [x] Open items updated (boundary check still UNRESOLVED until later issue)
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout)

## Edge Cases
- [x] Tenancy / Integration Core decisions not weakened
- [x] SagaTree domains/ listed as anti-goal

## Regression
- [x] N/A (docs-only)

## Secure-by-Default Coverage
- None (docs-only; no AuthZ/API/UI changes)

## Composition Gate
- SKIPPED — docs-only; no hop chain / UI composition (SHA recorded at commit)

## Assumptions
- none

## Implementation Notes
- Added `Arch-sharpen (2026-11-05)` row to DECISIONS.md
- Created docs/ARCHITECTURE.md with module template, schema ownership target, web naming Soll, anti-goals
- AGENTS.md points to ARCHITECTURE as canonical contract
