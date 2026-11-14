# Composition Gate — auth-bundles-phase1

- HEAD_SHA: 1b3353dac620de1e80277d95b16aa429d691985c
- Date: 2026-11-11
- Verdict: CLEAR

## Event
Bootstrap / invite / company-create / bundle-assign — AuthN (Better Auth) then AuthZ (BU2 resolver).

## Hops
1. Better Auth session cookie → `req.user` (plugins/auth.ts)
2. Membership + platform_grants + membership_bundles → effective permissions
3. Route handlers call `can*` / `assertPermission` / `assertCanCreateCompany`
4. Seed may upsert Better Auth `user`/`account` when BU2 profile exists without credential (login hop)

## Simulations
| Sim | Result | Notes |
|-----|--------|-------|
| N-actors | CLEAR | Invite consume is one-time (acceptedAt); membership unique (businessId,userId); bootstrap only when users count=0 |
| Invalid / missing fallback | CLEAR | Unknown permission keys DENY; open signup disabled; company create requires platform grant (not membership role) |
| Concurrent consumers | CLEAR | Last-owner check before remove; bundle version conflict on update; no dual role ACL |

## Cardinality
- Bootstrap → exactly one first user + one first company + one `companies.create` grant
- Invite accept → one membership (+ N bundle links), no second identity for same email
- Bundle assign → replace set for membership (not fan-out emails)
