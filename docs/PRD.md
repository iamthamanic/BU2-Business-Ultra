# PRD — Business Ultra 2 (Draft)

> Scaffolded by `/project-setup` from README / DECISIONS. Confirm and expand with product owners.

## Problem

Teams need one dark-ops workspace for marketing ops, product work, customer CRM, and project/task execution under multi-tenant company slugs.

## Users

- Bootstrap owner / company admins
- Operators working Marketing, Produkt, Kunden, Projekte

## Goals (v1 scope from shipped surface)

- Invite-only tenancy at `/co/:slug/...`
- Modules: Marketing hub, Produkt, Kunden (CRM), Projekte (areas + tasks/board)
- Dark-Ops UI with DE/EN i18n
- API + Postgres persistence; provider keys gated in Settings

## Non-Goals

- Public self-serve SaaS signup
- Full redesign away from Dark-Ops without explicit decision
- Fake CRM demo rows in empty states

## Constraints

- pnpm monorepo; Vite React web; Fastify API; Playwright e2e
- Secure-by-default checklist in AGENTS.md
- UI must follow [docs/UI_STYLEGUIDE.md](./UI_STYLEGUIDE.md)

## Success metrics (placeholder)

- Core e2e suite green
- Empty CRM/project states usable without mock data
