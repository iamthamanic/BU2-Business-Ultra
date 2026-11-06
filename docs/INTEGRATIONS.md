<!-- contract-status: binding -->
<!-- scope: integrations -->
<!-- authoritative-sources: DECISIONS.md Integration Core, apps/api/src/lib/integrations/** -->
<!-- last-confirmed: 2026-11-04 (owner approved) -->

# Integrations — Business Ultra 2

> Binding integrations contract (owner-approved 2026-11-04). **No credentials or secrets in this document.** Names only.
> Catalog rows reflect Ist code; live readiness still depends on env/keys.

## Model (binding intent — DECISIONS)

```
Provider  →  Connection  →  Binding (+ credentials, capability resolver, sync/webhooks, outbox)
```

- **Modules** own domain tables (inbox messages, ads campaigns, …).
- **Integration Core** owns connections / credentials / module bindings / sync cursors / outbox.
- **`settings_secrets`** remains for single API-key feature gates (Metricool, Brevo send, …).
- Multi-account mailboxes/pages use `connections` + credentials — not settings_secrets alone.

Code registry: `apps/api/src/lib/integrations/core/providers.ts`  
HTTP: `apps/api/src/modules/integrations/*` under `/api/b/:slug/integrations/…`

## Connector DX (batteries-included)

**Goal:** new services are **adapter + catalog row only** — credentials in Connections, no one-off secret UIs.

**Program order:** Social → Paid → Finance → Generic (`domainGroup` on `PROVIDER_CATALOG`).

| Group | Intent | Ist examples |
|-------|--------|--------------|
| `social` | Messaging / inbox / organic social | Gmail, Outlook, IMAP, WhatsApp, Instagram, Facebook, Telegram, Unipile |
| `paid` | Ads / paid social video | YouTube, Google Ads |
| `finance` | Bank / bookkeeping (credentials-only) | `finapi` (credentials stored; sync pending) |
| `generic` | Test / catch-all | Mock |

**Add a connector (checklist):**

1. Extend `IntegrationProviderSchema` in `packages/shared`
2. Add catalog row in `lib/integrations/core/providers.ts` with `domainGroup` + `authMethods` + `connectKind`
3. Copy `lib/integrations/core/adapterTemplate.ts` → `lib/integrations/<provider>/adapter.ts`, implement `connect` / `resolveCapabilities`, register on boot
4. Prefer OAuth PKCE or API key; persist via Integration Core credentials — never `settings_secrets` for multi-account
5. Sync/send live in a follow-up slice after credentials path is green

Template: `apps/api/src/lib/integrations/core/adapterTemplate.ts`

## Provider catalog (Ist)

From `PROVIDER_CATALOG` (adapterReady flags are code claims; live mode still needs env/keys):

| Provider id | Label | Group | Auth methods | Connect kind |
|-------------|-------|-------|--------------|--------------|
| `mock` | Mock (contract tests) | generic | `mock` | mock |
| `google` | Gmail | social | `oauth_pkce` | oauth |
| `youtube` | YouTube | paid | `oauth_pkce` | oauth |
| `google_ads` | Google Ads | paid | `oauth_pkce` | oauth |
| `microsoft` | Outlook | social | `oauth_pkce` | oauth |
| `imap` | IMAP / POP | social | `password` | password |
| `whatsapp` | WhatsApp | social | `oauth_pkce` | oauth |
| `instagram` | Instagram | social | `oauth_pkce` | oauth |
| `facebook` | Facebook | social | `oauth_pkce` | oauth |
| `telegram` | Telegram (Bot) | social | `bot_token` | bot_token |
| `unipile` | Telegram (privat) | social | `aggregator_session`, `api_key` | aggregator |
| `finapi` | finAPI (Bank) | finance | `api_key` | password (client id/secret form) |

### Related non-catalog / settings-gated

| Integration | Typical path | Notes |
|-------------|--------------|-------|
| Metricool | `lib/integrations/metricool.ts` + settings secret | Scheduler SoR (DECISIONS) |
| Brevo | `lib/integrations/brevo.ts` / `lib/brevo.ts` | Mail / campaigns; key-gated |
| Ads helpers | `lib/integrations/ads.ts`, `googleAds/`, youtube client | Paid channels; often stub without keys |
| OpenSEO | `modules/openseo` + `openseo/` | Digest-pinned; SSO stubs |

## Adapter responsibilities

| Layer | Path | Duty |
|-------|------|------|
| Core types / list / bind | `lib/integrations/core/*` | Connection CRUD helpers, capabilities, mock adapter |
| OAuth PKCE | `lib/integrations/oauth/*` | authorize, exchange, complete, redirects, state, pkce store |
| Channel adapters | `telegram/`, `gmail/`, `unipile/`, `imap/`, … | Sync + send for that provider |
| Module routes | `modules/integrations`, inbox, marketing, ads | AuthZ + business scoping |

## Credentials

| Kind | Where |
|------|-------|
| OAuth client id/secret (platform) | Env — see `.env.example` / `.github/SECRETS.md` |
| Per-connection tokens | DB `connection_credentials` (encrypted at rest via app crypto) |
| Bot tokens / aggregator | Same credentials table / Unipile env (`UNIPILE_DSN`, `UNIPILE_ACCESS_TOKEN`) |
| Single feature API keys | `settings_secrets` via Settings UI |

Never commit real values. UI: Settings → Verbindungen.

## OAuth / redirects

- Flow: PKCE authorize → provider → callback → `oauth/complete` upserts connection.
- Redirect keys: `lib/integrations/oauth/redirects.ts` + `PUBLIC_WEB_URL` / `PUBLIC_API_URL`.
- Gmail launch: restricted scopes; public OAuth verification is a release-plan item (DECISIONS) — OK for local/dev.

## Webhooks / sync

- Sync cursors: `sync_cursors`
- Outbox for outbound side effects: `outbox_jobs` (idempotency / claim — **P-06**)
- Provider webhooks: **UNRESOLVED** per-provider inventory (document as adapters land)

## Errors / retry / rate limits

- Adapter errors should surface as structured API errors; live mutate may return stubs when misconfigured (see ads stub pattern).
- Retry/backoff policy: **UNRESOLVED** as a single global contract — follow outbox worker behavior in code.
- Auth / OAuth endpoints: rate limit expected (**P-05**).

## Fallback / provider swap

- Direct official APIs preferred; Unipile (or peer) for restricted/user-session channels (DECISIONS).
- Diligence before production aggregator use.
- Mock provider for contract tests.

## Sync / idempotency

- Connection upsert keyed by business + provider + external account id (`oauth/complete.ts`).
- Inbox identity: `contact_identities` provisional; uncertain CRM match needs confirm; never cross-business merge.

## Inbox build order (product decision)

01 Connection Core → 02 Telegram Bot → **02b Telegram User via Unipile** → 03 Gmail/Outlook → 04 CRM/team → 05 Meta → 06 long-tail/automations (DECISIONS).

## Related

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [SECURITY.md](./SECURITY.md)
- `DECISIONS.md` — Integration Core, Capabilities, Omnichannel
