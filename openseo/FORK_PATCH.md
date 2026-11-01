# OpenSEO fork patch (apply upstream)

BU cannot publish to `every-app/open-seo` from this repo. Apply the following to your OpenSEO fork/deploy image before enabling live SSO.

## 1. Pin image digest

In `openseo/docker-compose.yml` replace:

```yaml
image: ghcr.io/every-app/open-seo-standalone@sha256:REPLACE_WITH_VERIFIED_DIGEST
```

Obtain digest:

```bash
docker pull ghcr.io/every-app/open-seo-standalone:latest
docker image inspect ghcr.io/every-app/open-seo-standalone:latest --format '{{index .RepoDigests 0}}'
```

Set GitHub Secret `OPENSEO_IMAGE_DIGEST` to the sha256 hex.

## 2. Add SSO consumer route (sketch)

```ts
// src/app/api/sso/bu2/route.ts (illustrative)
export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const business = url.searchParams.get('business')
  const sig = url.searchParams.get('sig')
  const redeem = await fetch(`${process.env.BU2_API_URL}/api/internal/openseo/redeem`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.OPENSEO_SSO_SHARED_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ token, businessSlug: business, sig }),
  })
  if (!redeem.ok) return new Response('SSO failed', { status: 401 })
  const identity = await redeem.json()
  // Create/login Better-Auth user bound to identity.openseoUserRef
  // Map roleMapped admin|member; enforce identity.denied capabilities server-side
  // Session cookie → redirect to business project home
}
```

## 3. Actor audit hook

After every mutating OpenSEO action:

```ts
await fetch(`${BU2_API_URL}/api/internal/openseo/audit`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${OPENSEO_SSO_SHARED_SECRET}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    businessId,
    actorUserId,
    openseoUserRef,
    action: 'report.update',
    resourceRef: reportId,
  }),
})
```

## 4. Editor capability deny-list

Never grant OpenSEO `owner` to BU editors. Use `member` (+ custom middleware) blocking:

- team/user/role admin
- credentials
- global integrations
- budgets
- irreversible deletes

BU redeem response already returns `capabilities` / `denied`.

## 5. Env for OpenSEO container

- `BU2_API_URL=http://api:8742`
- `OPENSEO_SSO_SHARED_SECRET=<same as BU>`
- `AUTH_MODE=password` (not `local_noauth` for multi-user)

## BU-side status

Handoff + redeem + audit broker are **implemented** in BU2 API. Live E2E remains blocked until this fork patch is deployed with a pinned digest.
