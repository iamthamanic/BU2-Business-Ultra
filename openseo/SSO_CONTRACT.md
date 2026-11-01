# BU2 ↔ OpenSEO SSO handoff contract

## Flow

1. Authenticated BU user with SEO access calls `POST /api/b/:slug/openseo/handoff`.
2. BU upserts `openseo_identities` (`bu2:{businessId}:{userId}`) and creates `openseo_handoffs` (TTL ≤ 60s).
3. Browser opens `{OPENSEO_BASE_URL}/sso/bu2?token=…&business=…&sig=…`.
4. OpenSEO fork redeems once via internal API (below).
5. OpenSEO establishes session as mapped identity; mutations call audit webhook.

## Redeem (implemented in BU)

```http
POST /api/internal/openseo/redeem
Authorization: Bearer {OPENSEO_SSO_SHARED_SECRET}
Content-Type: application/json

{ "token": "<one-time>", "businessSlug": "<slug>", "sig": "<optional hmac>" }
```

`sig` = HMAC-SHA256(`${token}.${businessSlug}`, `OPENSEO_SSO_SHARED_SECRET`) hex.

### Response

```json
{
  "openseoUserRef": "bu2:<businessId>:<userId>",
  "email": "user@example.com",
  "roleMapped": "admin|member",
  "capabilities": ["research", "analyze", "audit", "reports"],
  "denied": ["team_admin", "credentials", "global_integrations", "budgets", "irreversible_delete"],
  "businessId": "<uuid>",
  "actorUserId": "<uuid>"
}
```

## Actor audit (implemented in BU)

```http
POST /api/internal/openseo/audit
Authorization: Bearer {OPENSEO_SSO_SHARED_SECRET}

{
  "businessId": "<uuid>",
  "actorUserId": "<uuid>",
  "openseoUserRef": "bu2:…",
  "action": "report.update",
  "resourceRef": "<id>",
  "status": "ok",
  "meta": {}
}
```

Writes `openseo.actor.<action>` into BU `audit_log`.

## Security

- Token single-use; reject reuse / expiry.
- Shared secret server-side only (GitHub Secret `OPENSEO_SSO_SHARED_SECRET`).
- Never trust client role claims without redeem.
- See `FORK_PATCH.md` for OpenSEO-side apply steps.
