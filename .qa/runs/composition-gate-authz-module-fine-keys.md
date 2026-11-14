# Composition Gate — authz-module-fine-keys

- HEAD_SHA: 6de3c82d8602464fb939dae70c6d92ba8c9c4510
- Date: 2026-11-14
- Verdict: CLEAR

## Event
Member calls module API with/without the matching permission key.

## Hop chain
Session → `loadMembership` → `hasPermission(key)` → service scoped by `businessId` (+ project access where applicable)

## Simulations
| Case | Result |
|------|--------|
| Missing key | 403 |
| Has key + membership | proceed |
| Project without team membership | still blocked by assertProjectAccess |

## Flags
(none)
