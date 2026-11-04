# Required GitHub Secrets

Documented names only — configure in GitHub → Settings → Secrets and variables → Actions.

- `DATABASE_URL`
- `SECRETS_MASTER_KEY`
- `SESSION_SECRET`
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`
- `BOOTSTRAP_OWNER_EMAIL`
- `OPENSEO_SSO_SHARED_SECRET`
- `OPENSEO_BASE_URL`
- `OPENSEO_IMAGE_DIGEST`
- `PUBLIC_WEB_URL`
- `PUBLIC_API_URL`
- `CORS_ORIGIN`
- `SORTANIZE_URL` (optional override)

## Optional — messaging OAuth (Inbox connect)

Redirect URIs are derived from `PUBLIC_API_URL` at runtime (see Settings → Verbindungen). Register those URIs in Google / Azure / Meta; do not hardcode localhost in production.

- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`
- `MICROSOFT_OAUTH_CLIENT_ID` / `MICROSOFT_OAUTH_CLIENT_SECRET`
- `MICROSOFT_OAUTH_TENANT` (optional, default `common`)
- `META_OAUTH_APP_ID` / `META_OAUTH_APP_SECRET`
- `UNIPILE_DSN` / `UNIPILE_ACCESS_TOKEN` (personal Telegram via Unipile)
