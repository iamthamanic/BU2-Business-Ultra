/**
 * Frontend company URL helpers — legacy shell parity (`/co/:slug/...`).
 * API tenancy stays `/api/b/:slug` (unchanged). Location: apps/web/src/lib/companyPaths.ts
 */

export const DEFAULT_ORGANIC_CHANNEL = 'instagram'
export const DEFAULT_PAID_CHANNEL = 'google'
export const DEFAULT_CUSTOM_CHANNEL = 'email'

/** Legacy organic channel order (sidebar Organic Funnel). */
export const ORGANIC_CHANNELS = [
  'instagram',
  'facebook',
  'tiktok',
  'linkedin',
  'youtube',
] as const

/** Legacy paid channel keys used in `/marketing/funnel/paid/:channel`. */
export const PAID_CHANNELS = ['google', 'meta', 'tiktok', 'chatgpt'] as const

/** Legacy custom funnel channels. */
export const CUSTOM_CHANNELS = ['email', 'offline'] as const

export type OrganicChannel = (typeof ORGANIC_CHANNELS)[number]
export type PaidChannel = (typeof PAID_CHANNELS)[number]
export type CustomChannel = (typeof CUSTOM_CHANNELS)[number]

/** Build `/co/:slug` base (no trailing slash). */
export function companyBase(slug: string) {
  return `/co/${encodeURIComponent(slug)}`
}

/** Canonical user-facing paths under a company (legacy shell map). */
export function companyRoutes(slug: string) {
  const base = companyBase(slug)
  return {
    overview: base,
    catalog: `${base}/catalog`,
    marketing: `${base}/marketing/funnel/organic/${DEFAULT_ORGANIC_CHANNEL}`,
    organic: (ch: string) => `${base}/marketing/funnel/organic/${ch}`,
    ads: `${base}/marketing/funnel/paid/${DEFAULT_PAID_CHANNEL}`,
    paid: (ch: string) => `${base}/marketing/funnel/paid/${ch}`,
    custom: `${base}/marketing/funnel/custom/${DEFAULT_CUSTOM_CHANNEL}`,
    customCh: (ch: string) => `${base}/marketing/funnel/custom/${ch}`,
    cmb: `${base}/tools/cmb`,
    sortanize: `${base}/tools/sortanize`,
    checkmap: `${base}/tools/checkmap`,
    personas: `${base}/tools/persona-journey`,
    openseo: `${base}/tools/seo`,
    settings: `${base}/settings`,
  } as const
}

/**
 * Map pre-parity BU2 frontend paths (`/b/:slug/...`) onto legacy `/co/:slug/...`.
 * @param rest path after `/b/:slug/` (may be empty)
 */
export function mapOldBu2FrontendPath(slug: string, rest: string): string {
  const r = (rest || '').replace(/^\/+|\/+$/g, '')
  const routes = companyRoutes(slug)
  const map: Record<string, string> = {
    '': routes.overview,
    catalog: routes.catalog,
    marketing: routes.marketing,
    ads: routes.ads,
    cmb: routes.cmb,
    checkmap: routes.checkmap,
    personas: routes.personas,
    sortanize: routes.sortanize,
    openseo: routes.openseo,
    settings: routes.settings,
  }
  if (r in map) return map[r]!
  // Unknown remainder: keep under /co with same suffix
  return r ? `${companyBase(slug)}/${r}` : companyBase(slug)
}
