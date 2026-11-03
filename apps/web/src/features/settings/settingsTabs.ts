/**
 * Settings tab ids + hash deep-link mapping (Hub → #connections).
 * Location: apps/web/src/features/settings/settingsTabs.ts
 */

export const SETTINGS_TABS = ['overview', 'connections', 'funnel', 'team', 'labels', 'logo'] as const
export type SettingsTab = (typeof SETTINGS_TABS)[number]

const HASH_ALIASES: Record<string, SettingsTab> = {
  overview: 'overview',
  connections: 'connections',
  metricool: 'connections',
  email: 'connections',
  seo: 'connections',
  brevo: 'connections',
  funnel: 'funnel',
  team: 'team',
  labels: 'labels',
  tags: 'labels',
  logo: 'logo',
}

export function tabFromHash(hash: string): SettingsTab {
  const raw = hash.replace(/^#/, '').trim().toLowerCase()
  if (!raw) return 'overview'
  return HASH_ALIASES[raw] ?? 'overview'
}

export function hashForTab(tab: SettingsTab): string {
  return tab === 'overview' ? '' : `#${tab}`
}
