/**
 * Integration provider catalog (code registry — not a DB table).
 * Location: apps/api/src/lib/integrations/core/providers.ts
 */
import type { ConnectionAuthMethod, IntegrationProvider } from '@bu2/shared'

/** Batteries-included connector program order: Social → Paid → Finance → Generic. */
export type ProviderDomainGroup = 'social' | 'paid' | 'finance' | 'generic'

export type ProviderCatalogEntry = {
  id: IntegrationProvider
  label: string
  /** Auth methods this provider may use (UI picker). */
  authMethods: ConnectionAuthMethod[]
  /** Implemented adapters in this build (may still need env credentials). */
  adapterReady: boolean
  /** Connect UX kind. */
  connectKind: 'oauth' | 'bot_token' | 'aggregator' | 'password' | 'mock'
  /** Product lane for catalog grouping / roadmap. */
  domainGroup: ProviderDomainGroup
}

/** Order = connect-modal / providers-tab display order. */
export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: 'mock',
    label: 'Mock (contract tests)',
    authMethods: ['mock'],
    adapterReady: true,
    connectKind: 'mock',
    domainGroup: 'generic',
  },
  {
    id: 'google',
    label: 'Gmail',
    authMethods: ['oauth_pkce'],
    adapterReady: true,
    connectKind: 'oauth',
    domainGroup: 'social',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    authMethods: ['oauth_pkce'],
    adapterReady: true,
    connectKind: 'oauth',
    domainGroup: 'paid',
  },
  {
    id: 'google_ads',
    label: 'Google Ads',
    authMethods: ['oauth_pkce'],
    adapterReady: true,
    connectKind: 'oauth',
    domainGroup: 'paid',
  },
  {
    id: 'microsoft',
    label: 'Outlook',
    authMethods: ['oauth_pkce'],
    adapterReady: true,
    connectKind: 'oauth',
    domainGroup: 'social',
  },
  {
    id: 'imap',
    label: 'IMAP / POP',
    authMethods: ['password'],
    adapterReady: true,
    connectKind: 'password',
    domainGroup: 'social',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    authMethods: ['oauth_pkce'],
    adapterReady: true,
    connectKind: 'oauth',
    domainGroup: 'social',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    authMethods: ['oauth_pkce'],
    adapterReady: true,
    connectKind: 'oauth',
    domainGroup: 'social',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    authMethods: ['oauth_pkce'],
    adapterReady: true,
    connectKind: 'oauth',
    domainGroup: 'social',
  },
  {
    id: 'telegram',
    label: 'Telegram (Bot)',
    authMethods: ['bot_token'],
    adapterReady: true,
    connectKind: 'bot_token',
    domainGroup: 'social',
  },
  {
    id: 'unipile',
    label: 'Telegram (privat)',
    authMethods: ['aggregator_session', 'api_key'],
    adapterReady: true,
    connectKind: 'aggregator',
    domainGroup: 'social',
  },
]

export function providersByDomainGroup(group: ProviderDomainGroup): ProviderCatalogEntry[] {
  return PROVIDER_CATALOG.filter((p) => p.domainGroup === group)
}
