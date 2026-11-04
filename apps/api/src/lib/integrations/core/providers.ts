/**
 * Integration provider catalog (code registry — not a DB table).
 * Location: apps/api/src/lib/integrations/core/providers.ts
 */
import type { ConnectionAuthMethod, IntegrationProvider } from '@bu2/shared'

export type ProviderCatalogEntry = {
  id: IntegrationProvider
  label: string
  /** Auth methods this provider may use (UI picker). */
  authMethods: ConnectionAuthMethod[]
  /** Implemented adapters in this build (may still need env credentials). */
  adapterReady: boolean
  /** Connect UX kind. */
  connectKind: 'oauth' | 'bot_token' | 'aggregator' | 'password' | 'mock'
}

/** Order = connect-modal / providers-tab display order. */
export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: 'mock',
    label: 'Mock (contract tests)',
    authMethods: ['mock'],
    adapterReady: true,
    connectKind: 'mock',
  },
  {
    id: 'google',
    label: 'Gmail',
    authMethods: ['oauth_pkce'],
    adapterReady: true,
    connectKind: 'oauth',
  },
  {
    id: 'microsoft',
    label: 'Outlook',
    authMethods: ['oauth_pkce'],
    adapterReady: true,
    connectKind: 'oauth',
  },
  {
    id: 'imap',
    label: 'IMAP / POP',
    authMethods: ['password'],
    adapterReady: true,
    connectKind: 'password',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    authMethods: ['oauth_pkce'],
    adapterReady: true,
    connectKind: 'oauth',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    authMethods: ['oauth_pkce'],
    adapterReady: true,
    connectKind: 'oauth',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    authMethods: ['oauth_pkce'],
    adapterReady: true,
    connectKind: 'oauth',
  },
  {
    id: 'telegram',
    label: 'Telegram (Bot)',
    authMethods: ['bot_token'],
    adapterReady: true,
    connectKind: 'bot_token',
  },
  {
    id: 'unipile',
    label: 'Telegram (privat)',
    authMethods: ['aggregator_session', 'api_key'],
    adapterReady: true,
    connectKind: 'aggregator',
  },
]

export function getProviderEntry(id: string): ProviderCatalogEntry | undefined {
  return PROVIDER_CATALOG.find((p) => p.id === id)
}
