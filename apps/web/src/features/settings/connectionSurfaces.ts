/**
 * connectionSurfaces — UI taxonomy for Settings → Verbindungen tabs.
 * A provider may appear in multiple surfaces; connected accounts mirror accordingly.
 * Location: apps/web/src/features/settings/connectionSurfaces.ts
 */

export const CONN_SURFACES = [
  'social',
  'ads',
  'email',
  'finance',
  'aggregators',
  'tools',
] as const

export type ConnSurfaceId = (typeof CONN_SURFACES)[number]

export type SoonProvider = { id: string; label: string }

/** Live / known provider ids shown as connect cards on each surface (multi-membership OK). */
export const SURFACE_PROVIDERS: Record<ConnSurfaceId, string[]> = {
  social: ['instagram', 'facebook', 'youtube', 'whatsapp', 'linkedin', 'tiktok', 'x', 'pinterest'],
  ads: [
    'google_ads',
    'meta_ads',
    'tiktok_ads',
    'chatgpt_ads',
    'reddit_ads',
    'pinterest_ads',
    'microsoft_ads',
  ],
  email: ['google', 'microsoft', 'imap', 'whatsapp', 'telegram', 'instagram', 'facebook', 'brevo'],
  finance: ['finapi'],
  aggregators: ['metricool', 'unipile'],
  tools: ['openseo'],
}

/** Roadmap cards — visible, disabled Verbinden, status “Bald”. */
export const SURFACE_SOON: Record<ConnSurfaceId, SoonProvider[]> = {
  social: [],
  ads: [],
  email: [],
  finance: [
    { id: 'datev', label: 'DATEV' },
    { id: 'lexoffice', label: 'Lexoffice' },
    { id: 'stripe', label: 'Stripe' },
  ],
  aggregators: [],
  tools: [],
}

/** Integration Core OAuth / bot / IMAP — open ConnectAccountModal. */
export const CORE_CONNECT_PROVIDERS = new Set([
  'google',
  'microsoft',
  'imap',
  'whatsapp',
  'instagram',
  'facebook',
  'telegram',
  'unipile',
  'youtube',
  'google_ads',
  'meta_ads',
  'linkedin',
  'tiktok',
  'tiktok_ads',
  'x',
  'pinterest',
  'pinterest_ads',
  'chatgpt_ads',
  'reddit_ads',
  'microsoft_ads',
])

/**
 * API-key providers — Verbinden opens ConnectApiKeyModal → settings_secrets
 * (feature gates; paid ads use OAuth).
 */
export const API_KEY_CONNECT_PROVIDERS = new Set(['brevo', 'metricool'])

export const ADS_PROVIDER_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  tiktok_ads: 'TikTok Ads',
  chatgpt_ads: 'ChatGPT Ads',
  reddit_ads: 'Reddit Ads',
  pinterest_ads: 'Pinterest Ads',
  microsoft_ads: 'Microsoft Ads',
  brevo: 'Brevo',
  metricool: 'Metricool',
}

/** Hash fragment → surface (after Settings tab resolves to connections). */
export const SURFACE_HASH: Record<string, ConnSurfaceId> = {
  social: 'social',
  'connections-social': 'social',
  ads: 'ads',
  'ad-platforms': 'ads',
  'connections-ads': 'ads',
  email: 'email',
  messenger: 'email',
  'email-messenger': 'email',
  'connections-email': 'email',
  brevo: 'email',
  finance: 'finance',
  'finance-connections': 'finance',
  finapi: 'finance',
  aggregators: 'aggregators',
  metricool: 'aggregators',
  unipile: 'aggregators',
  tools: 'tools',
  seo: 'tools',
  openseo: 'tools',
}

export function surfaceFromHash(hash: string): ConnSurfaceId | null {
  const raw = hash.replace(/^#/, '').trim().toLowerCase()
  if (!raw) return null
  return SURFACE_HASH[raw] ?? null
}

export function hashForSurface(surface: ConnSurfaceId): string {
  if (surface === 'finance') return '#finance-connections'
  if (surface === 'email') return '#connections-email'
  if (surface === 'ads') return '#connections-ads'
  if (surface === 'social') return '#connections-social'
  if (surface === 'aggregators') return '#aggregators'
  return '#tools'
}
