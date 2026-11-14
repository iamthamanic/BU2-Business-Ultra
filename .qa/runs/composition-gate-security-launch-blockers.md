# Composition Gate — security-launch-blockers

- HEAD_SHA: 7ab86090848cbc34196a839e9866c0b6c01731f5
- Date: 2026-11-14
- Verdict: CLEAR

## Event
Authenticated member downloads private media; invite grants bundles; outbox sends Telegram message once.

## Hop chain
Browser `<img src=/api/media/{bizId}/…>` (cookie) → `mediaRoutes` → `loadMembershipByBusinessId` → stream file  
Invite: `POST invites` → `assertBundlesAssignable` → accept → re-check inviter grants → membershipBundles  
Outbox: claim `pending→processing` WHERE pending → provider send

## Simulations
| Case | Result |
|------|--------|
| Anon media | 401 |
| Cross-tenant media | 403 |
| Invite escalate | 403 |
| Dual outbox worker | second claim no-op |

## Flags
(none)
