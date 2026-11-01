# Frontend routing — Legacy vs BU2

User-facing SPA paths only. **API remains `/api/b/:slug/...`** (BU2 contract).

## Tenant prefix

| | Path |
|---|---|
| Legacy | `/co/:companySlug/...` |
| BU2 (aligned) | `/co/:slug/...` |
| BU2 (old) | `/b/:slug/...` → redirects to `/co/...` |

Admin stays **global** (no company prefix): `/admin`. Auth: `/login`, `/login/verify`. Company picker home: `/`.

## Route map

| Area | Legacy | BU2 now | Notes |
|---|---|---|---|
| Overview | `/co/:slug/` | `/co/:slug/` | Same |
| Organic marketing | `/co/:slug/marketing/funnel/organic/:channel` | same | Channels: instagram, facebook, tiktok, linkedin, youtube. Default nav → `instagram` |
| Paid ads | `/co/:slug/marketing/funnel/paid/:channel` | same | Channels: google, meta, tiktok, chatgpt. Default → `google` |
| Custom funnel | `/co/:slug/marketing/funnel/custom/:channel` | same | email, offline → Marketing page (Brevo/custom) |
| CostMyBusiness | `/co/:slug/tools/cmb` | same | |
| Sortanize | `/co/:slug/tools/sortanize` | same | |
| CheckMap | `/co/:slug/tools/checkmap` (+ `/m/:mapId`) | same | Deep `mapId` accepted; canvas SoR unchanged |
| Personas / journey | `/co/:slug/tools/persona-journey` (+ `/p/:id/j/:id`) | same | Alias `/tools/personas` → persona-journey |
| OpenSEO / SEO | `/co/:slug/tools/seo` | same | |
| GEO | `/co/:slug/tools/geo` | → `/tools/seo` | **Deviation:** BU2 single OpenSEO module |
| Catalog | _(none)_ | `/co/:slug/catalog` | **BU2-only** SoR for products |
| Settings / keys | _(in-admin / overlays)_ | `/co/:slug/settings` | **BU2-only** dedicated settings |
| Comments | `/comments` → overview | `/co/:slug/comments` → overview | Legacy removed tab |
| Short `/ads` | → paid/google | redirect under `/co` | |
| Short `/c/:channel` | → organic channel | redirect under `/co` | |
| Superadmin | `/admin` | `/admin` | Same |

## Old BU2 bookmarks

`/b/:slug`, `/b/:slug/marketing`, `/b/:slug/cmb`, … redirect to the canonical `/co/...` paths above.

## Intentional deviations

1. **API** still `/api/b/:slug` — do not rename without a versioned migration.
2. **Catalog** + **Settings** are first-class BU2 routes (not in legacy shell URL table).
3. **GEO** collapses to SEO/OpenSEO.
4. Channel segment is in the URL for shareability; module UIs may not yet filter by channel.
