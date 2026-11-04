# Design: Omnichannel Inbox + Integration Core

<!-- locked from product review 2026-11-04 — not a Chatwoot fork -->

## Problem & Intent

Business Ultra needs a **first-party Omnichannel Inbox** (own Dark-Ops UI + own message model) and a
**shared Integration Core** so Inbox, CRM, Marketing, Projects, and Calendar reuse the same provider
connections without duplicating OAuth/token/webhook logic — and without becoming a second product
(Chatwoot iframe/fork) or a giant integration monolith that owns domain tables.

## Non-Goals

- Chatwoot / Yuva / Inbox Zero fork or embedded foreign UI
- Turning `settings_secrets` into multi-mailbox account registry
- Auto-merging CRM contacts across channel identities without confirmation
- Unipile as default for every restricted channel
- Full channel library before one end-to-end real channel works
- Treating Calendar as a fake message channel
- AGPL code copy; enterprise Chatwoot code copy

## Assumptions

- Tenancy stays `business_id` everywhere (strict isolation even if same phone exists in two businesses)
- Stack stays Fastify + Drizzle + Postgres + Vite/React Dark-Ops
- Existing `settings_secrets` (1 secret / business / provider) remains for **API-key style** gates
  (Metricool, Brevo, Ads); multi-account OAuth/bot connections need a **new** table family
- `business_integrations` today is Metricool brand/project binding — related idea, not sufficient as
  Connection Core (no credentials, no auth method, no module bindings, no health)

## Options Considered

### Option A (recommended): Own Inbox + Integration Core + swappable adapters

- Summary: Build BU2 Inbox module + Integration Core (Provider / Connection / Binding / Sync /
  Outbox / Capability Resolver). Adapters = Google, Microsoft, Meta, Telegram, optional Unipile.
- Pros: Fits monorepo; reuses secrets encryption patterns; capability-gated; clean CRM coupling
- Cons: More upfront modeling than “paste Unipile + Chatwoot”
- Evidence: Current main has secrets + partial integrations; no OAuth core / message model (repo audit)

### Option B: Embed Chatwoot

- Rejected: second app, foreign UI, Ruby stack, weak CRM/project coupling to BU2

### Option C: Nango-only Integration Core

- Deferred: viable later for long-tail OAuth; for 2–3 direct channels a thin in-house core is enough;
  revisit when provider count grows (~10–20)

## Decision

**Chosen:** Option A, with the six corrections below locked.

**Why:** Architecture direction was right; reliability, identity, capabilities, and multi-account
credentials were underspecified. Implementation order is thin-vertical (one real channel E2E) not
“full core then channel zoo”.

### Locked corrections (vs first Cursor sketch)

1. **Three concepts, not “OAuth vault” alone**
   - **Provider** — Google, Microsoft, Meta, Telegram, Unipile, …
   - **Connection** — one connected account (Gmail mailbox, IG page, Telegram bot, …) with auth
     method ∈ {oauth_pkce, bot_token, api_key, aggregator_session}
   - **Binding** — which BU2 module uses which Connection for which function
     (e.g. Inbox:read_mail, Marketing:publish, Ads:insights)
   - UI: one unified “connect” flow; auth method is adapter-specific

2. **Capabilities are structured, not booleans**
   - Include: permissions/scopes granted, account/page type, message formats, time windows
     (e.g. WhatsApp 24h service window → free reply vs template), and **live availability**
   - Resolver output drives UI (send button / template picker / disabled + reason)

3. **Reliability stack beyond send-queue**
   - Provider message IDs + idempotent ingest (dedupe)
   - Sync cursors / delta tokens; webhook ingestion + renewals (Gmail watch, Graph subscriptions)
   - Retry, rate limits, dead-letter / failed jobs, delivery status on outbound
   - Documented full-resync path when cursor invalid

4. **CRM identity is provisional**
   - `contact_identities` link channel handles → customer with confidence
   - Uncertain matches require human confirm; never cross-business merge

5. **Unipile = optional adapter after diligence**
   - Cost, privacy, account risk, ops supported, exit/portability — then enable per capability

6. **Gmail is early but not “easy launch”**
   - Restricted scopes + OAuth verification / security assessment for public distribution
   - Allowed in **dev**; public launch checklist must include Google verification plan

### Module boundary

| Layer | Owns |
|-------|------|
| Integration Core | Connections, credentials, capability resolve, bindings, sync/webhook workers, outbox transport, audit/health |
| Inbox module | `conversations`, `messages`, assignment, status, search/filters, reply UX |
| Marketing / Ads | Own posts/campaigns; may **bind** same Meta Connection with different scopes |
| CRM | Customers; consumes identity links; Kommunikation tab = history view |
| Calendar | Sibling feature on same Core; not a message channel |

### Inbox UI (V1 surface)

Desktop three-pane Dark-Ops:

1. Conversation list — filters: All · Mine · Open; channel badges; account picker
2. Thread — history, composer, delivery state
3. Customer context — linked customer, appointments, tasks, activities, profile link

Mobile: same data, stacked views (list → thread → context). Capacitor later.

### Data model (first cut — Inbox + Core)

**Integration Core**

- `providers` (code catalog) or enum + registry in code
- `connections` — business_id, provider, auth_method, external_account_id, status, health, …
- `connection_credentials` — encrypted tokens/secrets (many per connection; rotate/refresh)
- `connection_capabilities` — structured JSON + computed cache
- `module_bindings` — connection_id, module, purpose, enabled
- `sync_cursors` — connection_id, stream, cursor, renewed_at
- `webhook_endpoints` / delivery log
- `outbox_jobs` — payload, attempts, next_run, status, provider_ref

**Inbox**

- `channel_accounts` — may 1:1 view of inbox-bound connections
- `conversations` — business_id, channel, connection_id, status, assignee, …
- `messages` — conversation_id, direction, provider_message_id (unique per connection), body, …
- `message_attachments`
- `contact_identities` — kind (email/phone/ig/…), value, customer_id nullable, confidence, confirmed_at

Do **not** overload `settings_secrets` for multi-mailbox OAuth.

### Implementation order (revised)

| Step | Scope |
|------|--------|
| **01** | Minimal Connection Core: Provider / Connection / Credential / Capability / Binding + **mock adapter** + contract tests |
| **02** | Inbox E2E Telegram **Bot** (connect → sync → read → reply → delivery). Proof of Inbox model; Bot API **cannot** see personal DMs |
| **02b** | Telegram **User** (private account DMs) via Unipile `aggregator_session` — same Inbox UI, second Connection type; diligence gate before prod |
| **03** | Gmail + Outlook with real multi-account connections, threads, attachments, cursors, outbound + OAuth verification plan |
| **04** | CRM link + team: identity confirm, customer pane, assign, create task; identities in schema from day 1 of Inbox |
| **05** | WhatsApp / IG / Messenger with capability-gated send rules |
| **06** | Further aggregator/long-tail channels case-by-case; then automations / optional AI |

**Product goal (locked 2026-11-04):** Connect many channel *accounts* (bot **and** personal where the network allows) and see/reply in one Omnichannel Inbox. Per-provider auth differs; the Inbox never assumes Bot API = full Telegram.

**UX target (mockups 2026-11-04):** Settings → Verbindungen = connection hub (table, usage tags, connect wizard); Inbox = sources strip + filters + thread + CRM pane. Shell shipped in `omnichannel-ux-shell`; providers fill in 02b+.

### Nango

Not excluded a priori. Prefer thin in-house core for first channels; **revisit Nango Cloud vs own OAuth
maintenance** when provider count or refresh/edge-case cost grows. ELv2: do not ship Nango’s
substantial feature set as a hosted multi-tenant service without license review.

### Clean Room / licenses

- Study Chatwoot **concepts** (MIT community); rewrite in BU2 stack
- Do not copy Chatwoot enterprise/ or AGPL projects (Inbox Zero, Yuva server)
- Attribute MIT snippets if ever used; prefer rewrite

## Cross-Domain Sign-Off

| Domain | Status | Note |
|--------|--------|------|
| KISS | OK | One channel E2E before channel zoo |
| SOLID | OK | Core ≠ Inbox domain tables |
| DRY | OK | Shared connections; module-specific bindings |
| Security | OK | Encrypted credentials; tenant isolation; provisional identity |
| UI/UX | OK | Dark-Ops three-pane; mobile stacked |
| Scaling | OK | Outbox + cursors + webhook renewals |
| Testability | OK | Mock adapter + contract tests in step 01 |
| Maintainability | OK | Adapter interface; Unipile optional |

## Confidence

**78%** — product architecture locked; schema field-level + webhook renewals still need per-provider specs in step 01/02.

## Implementation Sketch

1. Issue `@issue-contract` for step 01 (Connection Core + mock)
2. Drizzle migrations for core tables (no inbox messages yet except stubs if needed for tests)
3. Adapter interface: `connect`, `refresh`, `capabilities`, `pull`, `send`, `verifyWebhook`
4. Then issue for step 02 Telegram Inbox E2E + UI shell

## Open Questions

- Exact assignee/RBAC for Inbox (editor vs dedicated inbox role)?
- Store `connection_capabilities` fully computed vs raw scopes + resolve-on-read?
- Outbox in Postgres table vs existing job runner (none yet — likely Postgres outbox first)?
- Public Google OAuth verification owner/timeline for production Gmail?

## Related

- Prior art: `~/.cursor/prior-art/bu2-omnichannel-inbox.md`
- Repo: `settings_secrets` unique (biz, provider); `business_integrations` for Metricool brands
EOF