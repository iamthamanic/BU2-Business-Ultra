# Business Ultra 2 — Locked Decisions (R1–R10)

Source of truth for implementation. Overrides conflicting Cursor user-rules (no Next.js, no Supabase, no DaisyUI mandate).

| ID | Decision |
|---|---|
| 1A | V1 Must originally excluded CRM/ERP/workflow/billing SaaS |
| 1A-rev | **CRM (Kunden) + Projects/Tasks in scope** — ERP/billing SaaS still out; CheckMap stays separate SoR |
| 2B-rev A | Vite + React + TypeScript frontend; Node LTS + TypeScript strict API (Fastify); Drizzle + Postgres 16; Docker volumes |
| Dark-Ops | Legacy Dark-Ops visual baseline (`#0b0f14` canvas, icon rail) |
| Ports | Web `http://127.0.0.1:8741`, API `:8742` |
| 3A | OpenSEO fork/patch path prepared; pin `ghcr.io/every-app/open-seo-standalone` by digest; SSO contract stubs + docs |
| 4C+15A | Settings UI for API keys; features disabled until key valid; Metricool/Paid/Brevo/ChatGPT keys |
| 5B | Paid Google/Meta/TikTok/ChatGPT Ads + Brevo send as Must (confirm gates); key-gated live mode |
| 6C | Local first |
| 7/28 | Bootstrap owner `raccoova@gmail.com`; sender `social@halteverbot123.de` |
| 8A | Brevo magic-link/OTP |
| 9A | CMB like legacy + golden fixtures port |
| 10A | No legacy data import |
| 11A | User as breakglass operator |
| 12A | Dark-Ops |
| 13A | CheckMap canvas, Persona PDF, Sortanize Python sidecar, Logo-crop ALL in R1 |
| 14A | ChatGPT Ads live-must (key-gated) |
| 16A | `mail.send` Owner/Admin only |
| 17B | Superadmin UI |
| 18A | Postgres + local persist volumes |
| 19A | Empty start — owner creates first business |
| 20A | OpenSEO pin as proposed |
| 23B | Core acceptance subset |
| 24B | DE+EN i18n |
| 27A | No hard deadline |
| 30 | Secrets via GitHub Secrets; commit `.env.example` names only |
| Tenancy | Business auth root; Owner/Admin/Editor/Viewer; invite-only; frontend URLs `/co/:slug/...` (legacy parity); API `/api/b/:slug/...` |
| Mobile | Icon-rail overlay, NO bottom nav |
| Marketing | Metricool-first scheduler SoR; master draft + target variants |
| Catalog | Catalog SoR; CMB internal simulation |
| Lifecycle | Archive not delete |
| Inbox | **First-party Omnichannel Inbox** — own Dark-Ops UI + message model; no Chatwoot/Yuva fork or iframe |
| Integration Core | Shared **Provider → Connection → Binding** (+ credentials, capability resolver, sync/webhooks, outbox); modules own domain tables |
| Connections ≠ secrets | Keep `settings_secrets` for single API-key gates; **multi-account** mailboxes/pages use new `connections` / credentials tables |
| Capabilities | Structured (scopes, account type, formats, time windows, live availability) — not booleans alone |
| Identity | `contact_identities` provisional; uncertain CRM match needs confirm; never cross-business merge |
| Adapters | Direct where official APIs cover the use case; Unipile (or peer) for restricted/user-session channels (e.g. Telegram personal DMs); diligence before prod |
| Omnichannel accounts | Product goal = connect bot **and** personal channel accounts into one Inbox; auth method per Connection (`bot_token` vs `aggregator_session` vs OAuth) |
| Inbox build order | 01 Connection Core → 02 Telegram Bot E2E → **02b Telegram User via Unipile** → 03 Gmail/Outlook → 04 CRM/team → 05 Meta → 06 long-tail/automations |
| Gmail launch | Restricted scopes; OAuth verification / assessment in public release plan (OK for local/dev) |

## Precedence notes (from PRD S-058)

- BU owns passwordless email auth; OpenSEO SSO is a separate short-lived handoff (stubs in V1 until E2E proven).
- OpenSEO editors with `seo.open` grant: research/audits/reports across all projects of that business; no team/credential/budget/irreversible delete.
- Last owner cannot leave without transfer; archive blocked until remote posts terminal.
- System operator = breakglass recovery/infra only, not content superuser.
