# Required GitHub Secrets

Documented names only — configure in GitHub → Settings → Secrets and variables → Actions.
Do not put these values in the repo. Local development uses `.env.local` (preferred) or `.env` — both are gitignored.

## CI / deploy (Required unless noted)

- `DATABASE_URL`
- `SECRETS_MASTER_KEY`
- `SESSION_SECRET`
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`
- `BOOTSTRAP_OWNER_EMAIL`
- `OPENSEO_SSO_SHARED_SECRET`
- `OPENSEO_BASE_URL`
- `OPENSEO_IMAGE_DIGEST` (CI-only — image pin for OpenSEO sidecar)
- `PUBLIC_WEB_URL`
- `PUBLIC_API_URL`
- `CORS_ORIGIN`
- `SORTANIZE_URL` (optional override)

## Optional — messaging OAuth (Inbox / Verbindungen)

Redirect URIs are **derived from `PUBLIC_API_URL`** at runtime (`GET /api/oauth/redirect-uris`).
Register the exact URIs in each Developer Console; do not invent a separate `*_OAUTH_REDIRECT_URI` env var.

| Provider | Local callback | Production example |
|----------|----------------|--------------------|
| Google | `http://127.0.0.1:8742/api/oauth/google/callback` | `https://business-ultra.raccoova.com/api/oauth/google/callback` |
| Microsoft | `http://127.0.0.1:8742/api/oauth/microsoft/callback` | `https://business-ultra.raccoova.com/api/oauth/microsoft/callback` |
| Meta | `http://127.0.0.1:8742/api/oauth/meta/callback` | `https://business-ultra.raccoova.com/api/oauth/meta/callback` |
| LinkedIn | `…/api/oauth/linkedin/callback` | same host pattern |
| TikTok | `…/api/oauth/tiktok/callback` | same host pattern |
| X | `…/api/oauth/x/callback` | same host pattern |
| Pinterest | `…/api/oauth/pinterest/callback` | same host pattern |
| Reddit | `…/api/oauth/reddit/callback` | same host pattern |
| ChatGPT Ads | `…/api/oauth/chatgpt/callback` | same host pattern |

Env names (platform Client ID/Secret only):

- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`
- `MICROSOFT_OAUTH_CLIENT_ID` / `MICROSOFT_OAUTH_CLIENT_SECRET` (Outlook + Microsoft Ads)
- `MICROSOFT_OAUTH_TENANT` (optional, default `common`)
- `META_OAUTH_APP_ID` / `META_OAUTH_APP_SECRET`
- `LINKEDIN_OAUTH_CLIENT_ID` / `LINKEDIN_OAUTH_CLIENT_SECRET`
- `TIKTOK_OAUTH_CLIENT_KEY` / `TIKTOK_OAUTH_CLIENT_SECRET`
- `X_OAUTH_CLIENT_ID` / `X_OAUTH_CLIENT_SECRET`
- `PINTEREST_OAUTH_CLIENT_ID` / `PINTEREST_OAUTH_CLIENT_SECRET`
- `REDDIT_OAUTH_CLIENT_ID` / `REDDIT_OAUTH_CLIENT_SECRET`
- `CHATGPT_ADS_CLIENT_ID` / `CHATGPT_ADS_CLIENT_SECRET`
- `UNIPILE_DSN` / `UNIPILE_ACCESS_TOKEN` (personal Telegram via Unipile)

### Optional — finAPI (Finance / Open Banking)

Platform app credentials (same pattern as OAuth clients). **Not** the end-user bank login.

- `FINAPI_CLIENT_ID` / `FINAPI_CLIENT_SECRET`
- `FINAPI_DATA_DECRYPTION_KEY` (optional)
- `FINAPI_BASE_URL` (optional; defaults to sandbox `https://sandbox.finapi.io`)
- `GOOGLE_ADS_DEVELOPER_TOKEN` (optional; required for live Google Ads API calls)

Per-business bank access tokens go in Integration Core after Web Form connect — never in global env.

**Status:** finAPI Settings form removed — env only. Bank Web Form still pending. Google Ads OAuth uses `GOOGLE_OAUTH_*`; developer token is separate.

Leave blank until the client exists. Empty = fail-closed (503). Do not use `CHANGE_ME` placeholders.

**Status:** authorize + PKCE + token exchange + encrypted credential persist for Google family (**Gmail**, **YouTube**, **Google Ads**), Microsoft, Meta (FB/IG/WA/Ads), **LinkedIn**, **TikTok** (+ Ads), **X**, **Pinterest** (+ Ads). One Developer Console app per family; separate connects = different scopes. Callback: `oauth_status=connected`. Publish/inbox sync for new socials may still be pending after connect.

**Google Ads:** enable **Google Ads API** on the same Cloud project as the OAuth client; manage access (Test / Explorer) in Cloud Console. No developer token in BU2. Do **not** use the “App Conversion Tracking and Remarketing API” form.

Production must terminate TLS and route `/api/oauth/*/callback` to the API.

## Boundary: global vs business secrets

| Layer | Examples | Where |
|-------|----------|--------|
| Global app | OAuth client id/secret, finAPI client id/secret, `SESSION_SECRET`, `SECRETS_MASTER_KEY`, Brevo platform key | Env / GitHub Secrets |
| Per-business | Access/refresh tokens, bank access after finAPI Web Form, Metricool keys, Ads developer tokens tied to a tenant | Integration Core (encrypted at rest with `SECRETS_MASTER_KEY`) |

Never put tenant tokens in global env. Rotating `SECRETS_MASTER_KEY` invalidates sealed credentials — re-connect integrations after a rotation.
