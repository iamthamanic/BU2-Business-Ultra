/**
 * Frontend company URL helpers — legacy shell parity (`/co/:slug/...`).
 * API tenancy stays `/api/b/:slug` (unchanged). Location: apps/web/src/lib/companyPaths.ts
 */

export const DEFAULT_ORGANIC_CHANNEL = 'instagram'
export const DEFAULT_PAID_CHANNEL = 'meta'
export const DEFAULT_CUSTOM_CHANNEL = 'email'

/** Organic social channels (Website is separate tab key `website`). */
export const ORGANIC_CHANNELS = [
  'instagram',
  'facebook',
  'tiktok',
  'linkedin',
  'youtube',
] as const

/** Organic tertiary tabs including Website (SEO surface). */
export const ORGANIC_TABS = [...ORGANIC_CHANNELS, 'website'] as const

/**
 * Paid channel order for Marketing tabs.
 * Route segment → provider id mapped in AdsPage.
 */
export const PAID_CHANNELS = [
  'meta',
  'google',
  'tiktok',
  'linkedin',
  'chatgpt',
  'microsoft',
] as const

/** Legacy custom funnel channels. */
export const CUSTOM_CHANNELS = ['email', 'offline'] as const

export type OrganicChannel = (typeof ORGANIC_CHANNELS)[number]
export type OrganicTab = (typeof ORGANIC_TABS)[number]
export type PaidChannel = (typeof PAID_CHANNELS)[number]
export type CustomChannel = (typeof CUSTOM_CHANNELS)[number]
export type FunnelKind = 'organic' | 'paid' | 'custom'
export type MarketingTopTab = 'funnel' | 'personas' | 'styleguide'
/** Organic/Paid surface under funnel — Analyse shows channels; Planung is calendar-only. */
export type FunnelSurface = 'analyse' | 'planung'

export const FUNNEL_PLANUNG_SEGMENT = 'planung'

/** Build `/co/:slug` base (no trailing slash). */
export function companyBase(slug: string) {
  return `/co/${encodeURIComponent(slug)}`
}

/** Canonical user-facing paths under a company (Marketing default landing). */
export function companyRoutes(slug: string) {
  const base = companyBase(slug)
  return {
    /** Marketing shell — default company landing */
    hub: `${base}/marketing`,
    /** Alias kept for older call sites; same as hub */
    overview: `${base}/marketing`,
    /** Katalog bookmarks resolve to Product placeholder for now */
    catalog: `${base}/product`,
    marketing: `${base}/marketing`,
    product: `${base}/product`,
    customer: `${base}/customer`,
    customerDetail: (id: string) => `${base}/customer/${encodeURIComponent(id)}`,
    projects: `${base}/projects`,
    projectsMine: `${base}/projects/mine`,
    projectsRecurring: `${base}/projects/recurring`,
    projectDetail: (id: string) => `${base}/projects/${encodeURIComponent(id)}`,
    marketingPersonas: `${base}/marketing/personas`,
    marketingStyleguide: `${base}/marketing/styleguide`,
    organic: (ch: string) => `${base}/marketing/funnel/organic/${ch}`,
    organicPlanung: `${base}/marketing/funnel/organic/${FUNNEL_PLANUNG_SEGMENT}`,
    ads: `${base}/marketing/funnel/paid/${DEFAULT_PAID_CHANNEL}`,
    paid: (ch: string) => `${base}/marketing/funnel/paid/${ch}`,
    paidPlanung: `${base}/marketing/funnel/paid/${FUNNEL_PLANUNG_SEGMENT}`,
    custom: `${base}/marketing/funnel/custom/${DEFAULT_CUSTOM_CHANNEL}`,
    customCh: (ch: string) => `${base}/marketing/funnel/custom/${ch}`,
    /** CMB bookmarks resolve to Product placeholder for now */
    cmb: `${base}/product`,
    sortanize: `${base}/tools/sortanize`,
    checkmap: `${base}/tools/checkmap`,
    /** Persona Journey lives under Marketing tabs */
    personas: `${base}/marketing/personas`,
    /** Website / SEO under Organic → Website */
    openseo: `${base}/marketing/funnel/organic/website`,
    geo: `${base}/marketing/funnel/organic/website?surface=geo`,
    settings: `${base}/settings`,
    settingsConnections: `${base}/settings#connections`,
    settingsLabels: `${base}/settings#labels`,
    /** @deprecated use settingsLabels */
    settingsTags: `${base}/settings#labels`,
  } as const
}

/**
 * Parse `/co/:slug/marketing/...` into tab state for MarketingShell.
 * Organic/Paid: `.../planung` → surface planung; otherwise analyse + channel.
 */
export function parseMarketingLocation(pathname: string): {
  top: MarketingTopTab
  funnel: FunnelKind
  channel: string
  surface: FunnelSurface
} {
  const m = pathname.match(/\/co\/[^/]+\/marketing(?:\/(.*))?$/)
  const rest = (m?.[1] || '').replace(/\/+$/, '')
  if (!rest || rest === '') {
    return {
      top: 'funnel',
      funnel: 'organic',
      channel: DEFAULT_ORGANIC_CHANNEL,
      surface: 'analyse',
    }
  }
  if (rest === 'personas' || rest.startsWith('personas/')) {
    return {
      top: 'personas',
      funnel: 'organic',
      channel: DEFAULT_ORGANIC_CHANNEL,
      surface: 'analyse',
    }
  }
  if (rest === 'styleguide' || rest.startsWith('styleguide/')) {
    return {
      top: 'styleguide',
      funnel: 'organic',
      channel: DEFAULT_ORGANIC_CHANNEL,
      surface: 'analyse',
    }
  }
  const parts = rest.split('/')
  if (parts[0] === 'funnel' && parts[1] && parts[2]) {
    const funnel = parts[1] as FunnelKind
    if (funnel === 'organic' || funnel === 'paid' || funnel === 'custom') {
      const seg = parts[2].toLowerCase()
      if ((funnel === 'organic' || funnel === 'paid') && seg === FUNNEL_PLANUNG_SEGMENT) {
        return {
          top: 'funnel',
          funnel,
          channel: funnel === 'paid' ? DEFAULT_PAID_CHANNEL : DEFAULT_ORGANIC_CHANNEL,
          surface: 'planung',
        }
      }
      return { top: 'funnel', funnel, channel: seg, surface: 'analyse' }
    }
  }
  return {
    top: 'funnel',
    funnel: 'organic',
    channel: DEFAULT_ORGANIC_CHANNEL,
    surface: 'analyse',
  }
}

/** Build path for a Marketing tab selection. */
export function marketingPath(
  slug: string,
  sel: {
    top: MarketingTopTab
    funnel?: FunnelKind
    channel?: string
    surface?: FunnelSurface
  },
): string {
  const routes = companyRoutes(slug)
  if (sel.top === 'personas') return routes.marketingPersonas
  if (sel.top === 'styleguide') return routes.marketingStyleguide
  const funnel = sel.funnel ?? 'organic'
  if (sel.surface === 'planung' && (funnel === 'organic' || funnel === 'paid')) {
    return funnel === 'paid' ? routes.paidPlanung : routes.organicPlanung
  }
  const channel =
    sel.channel ??
    (funnel === 'paid'
      ? DEFAULT_PAID_CHANNEL
      : funnel === 'custom'
        ? DEFAULT_CUSTOM_CHANNEL
        : DEFAULT_ORGANIC_CHANNEL)
  if (funnel === 'paid') return routes.paid(channel)
  if (funnel === 'custom') return routes.customCh(channel)
  return routes.organic(channel)
}

/**
 * Map pre-parity BU2 frontend paths (`/b/:slug/...`) onto legacy `/co/:slug/...`.
 * @param rest path after `/b/:slug/` (may be empty)
 */
export function mapOldBu2FrontendPath(slug: string, rest: string): string {
  const r = (rest || '').replace(/^\/+|\/+$/g, '')
  const routes = companyRoutes(slug)
  const map: Record<string, string> = {
    '': routes.hub,
    catalog: routes.catalog,
    katalog: routes.catalog,
    'product/katalog': routes.catalog,
    'product/catalog': routes.catalog,
    marketing: routes.hub,
    product: routes.product,
    customer: routes.customer,
    projects: routes.projects,
    ads: routes.ads,
    cmb: routes.cmb,
    costmybusiness: routes.cmb,
    'product/costmybusiness': routes.cmb,
    'product/cmb': routes.cmb,
    'tools/cmb': routes.cmb,
    checkmap: routes.checkmap,
    personas: routes.personas,
    sortanize: routes.sortanize,
    openseo: routes.openseo,
    settings: routes.settings,
  }
  if (r in map) return map[r]!
  // Unknown remainder: keep under /co with same suffix
  return r ? `${companyBase(slug)}/${r}` : routes.hub
}
