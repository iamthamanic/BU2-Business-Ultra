# Hostinger deploy — Business Ultra 2

Long-term production for Meta/Google OAuth HTTPS callbacks.

| Host | Stack |
|------|--------|
| `business-ultra.raccoova.com` | **BU2** (this compose) |
| `business-ultra.srv1492167.hstgr.cloud` | Legacy BU1 (unchanged) |

## Meta Developer Console

Valid OAuth Redirect URI:

```text
https://business-ultra.raccoova.com/api/oauth/meta/callback
```

App Domains: `business-ultra.raccoova.com` / `raccoova.com`  
Privacy / ToS / Data deletion: `/rechtliches/...` on the same host (SPA routes).

## Deploy

```bash
# On VPS after rsync of the monorepo to /docker/business-ultra-v2
cd /docker/business-ultra-v2
cp deploy/hostinger/.env.prod.example .env.prod
# fill secrets, then:
docker compose -f deploy/hostinger/docker-compose.yml --env-file .env.prod up -d --build
```

Before first cutover, remove `business-ultra.raccoova.com` from the legacy Traefik Host rules so only BU2 serves that domain.
