# Composition Gate — oauth-ads-social

- HEAD_SHA: WORKTREE (base 1b3353dac620de1e80277d95b16aa429d691985c)
- Date: 2026-11-14
- Verdict: CLEAR

## Event
Tenant admin connects paid/social OAuth; PKCE verifier travels via sealed cookie; tokens seal into Integration Core; marketing organic sync may read the same connection. Ads mutate uses connection tokens only.

## Hop chain
UI `POST …/oauth/:provider/start` (+ Set-Cookie PKCE) → IdP → `GET /api/oauth/<bucket>/callback` → take PKCE cookie → exchange → persist sealed creds → Settings  
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

## Flags
| Tag | Severity | Status |
|-----|----------|--------|
| (none open) | — | — |

## Skip reason
n/a
