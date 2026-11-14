# Epic Design — AuthZ Hardening & Security Launch Blockers

- **Slug:** `authz-hardening`
- **Date:** 2026-11-14
- **HEAD baseline:** `72f27c4`
- **Phase-0 inventory:** explore agent + `.qa/runs/security-checklist-full-codebase-20261114.md`

## Problem

BU2 has a real bundle permission catalog, but most routes only check membership or coarse `canMutateContent`. Launch blockers remain: public `/uploads/`, OpenSEO SSO default secret, invite grant-subset gap, missing helmet/API rate limits, non-atomic outbox claims, dependency audit debt.

## Goal

1. Close confirmed Critical/Important launch blockers (Epic A).
2. Evolve AuthZ toward `can(actor, action, resource, context)` on existing bundles — no second role system (Epics B–E).
3. HR: contract only until native product exists (Epic F) — **HR is not implemented today**.

## Non-goals

- Native HR app / speculative HR tables
- External policy engine (OPA/Casbin) without proven need
- Artificial payment approval workflow without real payouts
- Rewriting Better Auth

## Architecture decisions (binding for slices)

| Decision | Choice |
|----------|--------|
| Role model | Extend `permission_bundles` + keys; tenant-custom templates |
| Scope model | Add later via resource membership + visibility enums — not invent departments by abusing project categories |
| Sensitive data | Separate keys (`finance.*`, future `hr.salary.*`) never implied by generic `*.read` |
| Owner | Keep owner bypass for admin control; document exceptions for sensitive resources in later slices |
| Media | Authenticated media routes; remove public `@fastify/static` for private blobs |
| Platform ops | Superadmin/breakglass stay off `/api/b/:slug` content AuthZ |

## Epic map

| Epic | Focus | First slice |
|------|-------|-------------|
| A | Security launch blockers | `security-launch-blockers` |
| B | AuthZ core / scopes catalog | after A |
| C | Module route fine AuthZ | after B foundation |
| D | Permission management UI | after B |
| E | Migration + negative tests | continuous |
| F | HR integration contract (docs) | parallel docs-only |

## MVP cut (this PR / first implement)

Epic A only: uploads AuthZ, OpenSEO fail-closed, invite grant-subset (+ accept re-check), helmet, tiered rate limits, safe 5xx errors, atomic outbox claim, drop/replace vulnerable static, CI audit step, docs for restore/monitoring gaps (honest PARTIAL).

## Reuse

- `assertGrantSubset`, `hasPermission`, finance route pattern
- `SettingsTeamTab` / `BundlesEditor` for later UI
- `canAccessProjectTeam` for project scope precedent
