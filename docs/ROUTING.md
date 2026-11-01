# Frontend routing — Legacy vs BU2

User-facing SPA paths only. **API remains `/api/b/:slug/...`** (BU2 contract).

## Tenant prefix

| | Path |
|---|---|
| Legacy | `/co/:companySlug/...` |
| BU2 (aligned) | `/co/:slug/...` |
| BU2 (old) | `/b/:slug/...` → redirects to `/co/...` |

Admin stays **global** (no company prefix): `/admin`. Auth: `/login`, `/login/verify`. Company picker home: `/`.

## Shell IA (nav)

| Department | Nav items |
|---|---|
| **Marketing** | Hub · Organic (channels) · Paid (channels) · Custom (channels) · Persona Journey · SEO · GEO |
| **Tools** | CostMyBusiness · Sortanize · CheckMap |
| Footer | Einstellungen · language · logout |
| Topbar | Company switcher (unchanged) |

Default company landing after select: **Marketing Hub** (`/co/:slug` → `/co/:slug/marketing`).

SEO/GEO stay under Marketing in the sidebar; URLs remain `/tools/seo` and `/tools/geo` for bookmark/API compatibility.

## Route map

| Area | Legacy | BU2 now | Notes |
|---|---|---|---|
| Marketing Hub | Overview-ish | `/co/:slug/marketing` | Also `/co/:slug/` → redirect here |
| Organic marketing | `/co/:slug/marketing/funnel/organic/:channel` | same | Channels: instagram, facebook, tiktok, linkedin, youtube |
| Paid ads | `/co/:slug/marketing/funnel/paid/:channel` | same | Channels: google, meta, tiktok, chatgpt |
| Custom funnel | `/co/:slug/marketing/funnel/custom/:channel` | same | email, offline |
| CostMyBusiness | `/co/:slug/tools/cmb` | same | Tools dept |
| Sortanize | `/co/:slug/tools/sortanize` | same | Tools dept |
| CheckMap | `/co/:slug/tools/checkmap` (+ `/m/:mapId`) | same | Tools dept |
| Personas / journey | `/co/:slug/tools/persona-journey` | same | Marketing dept (nav); alias `/tools/personas` |
| OpenSEO / SEO | `/co/:slug/tools/seo` | same | Marketing dept (nav) |
| GEO | `/co/:slug/tools/geo` | same page family as SEO | Marketing dept; AI Visibility surface |
| Catalog | _(none)_ | `/co/:slug/catalog` | Top-level SoR |
| Settings / keys | _(in-admin / overlays)_ | `/co/:slug/settings` (+ `#connections`) | Footer |
| Comments | `/comments` → overview | → marketing hub | |
| Short `/ads` | → paid/google | redirect under `/co` | |
| Short `/c/:channel` | → organic channel | redirect under `/co` | |
| Superadmin | `/admin` | `/admin` | Same |

## Old BU2 bookmarks

`/b/:slug`, `/b/:slug/marketing`, `/b/:slug/cmb`, … redirect to the canonical `/co/...` paths above.

## Intentional deviations

1. **API** still `/api/b/:slug` — do not rename without a versioned migration.
2. **Catalog** + **Settings** are first-class BU2 routes (not in legacy shell URL table).
3. **GEO** shares OpenSEO module UI with a distinct nav entry and surface hint.
4. Channel segment is in the URL for shareability; module UIs may not yet filter by channel.
5. No separate **Website** sidebar department — SEO/GEO live under Marketing.
