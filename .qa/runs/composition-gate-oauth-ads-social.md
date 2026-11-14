# Composition Gate — oauth-ads-social

- HEAD_SHA: b18e7cdc55f6e36ad9e7815ad4c899bbb17bffd5
- Date: 2026-11-14
- Verdict: CLEAR

## Event
Tenant admin connects paid/social OAuth; PKCE verifier travels via sealed cookie; tokens seal into Integration Core; marketing organic sync may read the same connection. Ads mutate uses connection tokens only.

## Hop chain
UI `POST …/oauth/:provider/start` (+ Set-Cookie PKCE) → IdP → `GET /api/oauth/<bucket>/callback` → take PKCE cookie → exchange → persist sealed creds (atomic tx) → Settings  
Ads: `resolveAdsCredential` → connection only (settings_secrets PUT for ads → 410)  
Organic: funnel GET → `syncOrganicSocial` → posts UI  
Publish: stub only (no HTTP route)

## Simulations
| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| 1 event, N replicas | Same browser cookie carries PKCE | Cookie path `/api/oauth` SameSite=Lax + memory fallback | pass |
| invalid / missing profile id | Fail closed | chatgpt/microsoft_ads account_id_missing | pass |
| 2 consumers / crash | Single-use code + take-once PKCE cookie clear | No duplicate persist from stub publish | pass |
| ads secret upsert | Rejected | 410 ads_secret_retired | pass |
| credential replace crash | No empty credential set | `db.transaction` delete+insert | pass |

## Flags
| Tag | Severity | Status |
|-----|----------|--------|
| (none open) | — | — |

## Skip reason
n/a
