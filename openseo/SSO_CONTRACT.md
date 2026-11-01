# BU2 ↔ OpenSEO SSO handoff contract (stub)

## Flow

1. Authenticated BU user with SEO access calls `POST /api/b/:slug/openseo/handoff`.
2. BU creates `openseo_handoffs` row: `token_hash`, `expires_at` ≤ 60s, unused.
3. Browser opens `{OPENSEO_BASE_URL}/sso/bu2?token=…&business=…`.
4. OpenSEO fork (to implement) calls back BU (or shares HMAC) to redeem token once.
5. OpenSEO session is established as the mapped identity `bu2:{businessId}:{userId}`.

## Redeem request (proposed)

```http
POST /api/internal/openseo/redeem
Authorization: Bearer {OPENSEO_SSO_SHARED_SECRET}
Content-Type: application/json

{ "token": "<one-time>", "businessSlug": "<slug>" }
```

## Redeem response (proposed)

```json
{
  "openseoUserRef": "bu2:<businessId>:<userId>",
  "email": "user@example.com",
  "roleMapped": "admin|member",
  "capabilities": ["research", "analyze", "audit", "reports"],
  "denied": ["team_admin", "credentials", "global_integrations", "budgets", "irreversible_delete"],
  "businessId": "<uuid>"
}
```

## Security

- Token single-use; reject reuse.
- TTL ≤ 60s.
- Shared secret only server-side (GitHub Secret `OPENSEO_SSO_SHARED_SECRET`).
- Never trust client-supplied role claims without redeem.
