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
| **Product** | Katalog (default) · CostMyBusiness |
| **Customer** | Kunden list + detail tabs |
| **Projects** | Overview · Mine · Recurring · Detail |
| **Tools** | Sortanize |
| Footer | Einstellungen · language · logout |
| Topbar | Company switcher (unchanged) |

Sidebar order: **Marketing → Product → Customer** (Katalog is not a top-level rail item).

Default company landing after select: **Marketing Hub** (`/co/:slug` → `/co/:slug/marketing`).

SEO/GEO stay under Marketing in the sidebar; URLs remain `/tools/seo` and `/tools/geo` for bookmark/API compatibility.

## Route map

| Area | Legacy | BU2 now | Notes |
|---|---|---|---|
| Marketing Hub | Overview-ish | `/co/:slug/marketing` | Also `/co/:slug/` → redirect here |
| Organic marketing | `/co/:slug/marketing/funnel/organic/:channel` | same | Channels: instagram, facebook, tiktok, linkedin, youtube |
| Paid ads | `/co/:slug/marketing/funnel/paid/:channel` | same | Channels: google, meta, tiktok, chatgpt |
| Custom funnel | `/co/:slug/marketing/funnel/custom/:channel` | same | email, offline |
| CostMyBusiness | `/co/:slug/product/costmybusiness` | same | Under Product; `/tools/cmb` + `/cmb` redirect here |
| Sortanize | `/co/:slug/tools/sortanize` | same | Tools dept |
| CheckMap | `/co/:slug/tools/checkmap` (+ `/m/:mapId`) | same | No sidebar entry (direct URL / API only) |
| Personas / journey | `/co/:slug/tools/persona-journey` | same | Marketing dept (nav); alias `/tools/personas` |
| OpenSEO / SEO | `/co/:slug/tools/seo` | same | Marketing dept (nav) |
| GEO | `/co/:slug/tools/geo` | same page family as SEO | Marketing dept; AI Visibility surface |
| Catalog / Katalog | _(none)_ | `/co/:slug/product/katalog` | Under Product; `/catalog` + `/katalog` redirect here |
| Kunden | — | `/co/:slug/customer`, `/co/:slug/customer/:id` | CRM list + 5 tabs |
| Inbox | — | `/co/:slug/inbox` | Omnichannel messaging (Telegram Bot first) |
| Projekte | — | `/co/:slug/projects`, `/mine`, `/recurring`, `/:id` | Area/custom + tasks/board |
| Settings / keys | _(in-admin / overlays)_ | `/co/:slug/settings` (+ `#connections`) | Footer |
| Comments | `/comments` → overview | → marketing hub | |
| Short `/ads` | → paid/google | redirect under `/co` | |
| Short `/c/:channel` | → organic channel | redirect under `/co` | |
| Superadmin | `/admin` | `/admin` | Same |

## Old BU2 bookmarks

`/b/:slug`, `/b/:slug/marketing`, `/b/:slug/cmb`, … redirect to the canonical `/co/...` paths above.

## Intentional deviations

1. **API** still `/api/b/:slug` — do not rename without a versioned migration.
2. **Katalog** and **CostMyBusiness** live under **Product** (`/product/katalog`, `/product/costmybusiness`); **Settings** remains footer. Old `/catalog` and `/tools/cmb` bookmarks redirect.
3. **Product** sidebar highlights for all `/product/*` routes (Katalog + CostMyBusiness).
4. **GEO** shares OpenSEO module UI with a distinct nav entry and surface hint.
5. Channel segment is in the URL for shareability; module UIs may not yet filter by channel.
6. No separate **Website** sidebar department — SEO/GEO live under Marketing.
