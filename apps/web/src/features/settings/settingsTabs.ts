/**
 * Settings tab ids + hash deep-link mapping (Hub → #connections).
 * Location: apps/web/src/features/settings/settingsTabs.ts
 */

export const SETTINGS_TABS = ['details', 'connections', 'funnel', 'team', 'labels'] as const
export type SettingsTab = (typeof SETTINGS_TABS)[number]

const HASH_ALIASES: Record<string, SettingsTab> = {
  details: 'details',
  company: 'details',
  overview: 'details',
  logo: 'details',
  connections: 'connections',
  metricool: 'connections',
  email: 'connections',
  messenger: 'connections',
  'email-messenger': 'connections',
  'connections-email': 'connections',
  'connections-social': 'connections',
  'connections-ads': 'connections',
  social: 'connections',
  ads: 'connections',
  'ad-platforms': 'connections',
  aggregators: 'connections',
  tools: 'connections',
  seo: 'connections',
  openseo: 'connections',
  brevo: 'connections',
  unipile: 'connections',
  'finance-connections': 'connections',
  finapi: 'connections',
  finance: 'connections',
  funnel: 'funnel',
  team: 'team',
  labels: 'labels',
  tags: 'labels',
}

export function tabFromHash(hash: string): SettingsTab {
  const raw = hash.replace(/^#/, '').trim().toLowerCase()
  if (!raw) return 'details'
  return HASH_ALIASES[raw] ?? 'details'
}

export function hashForTab(tab: SettingsTab): string {
  return tab === 'details' ? '' : `#${tab}`
}
