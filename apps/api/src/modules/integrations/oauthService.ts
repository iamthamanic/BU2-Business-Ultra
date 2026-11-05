/**
 * OAuth helpers.
 * Location: apps/api/src/modules/integrations/oauthService.ts
 */
import { loadEnv } from '../../lib/env.js'
import { httpError } from '../../lib/httpError.js'

export { httpError }

export function settingsReturnUrl(slug: string): string {
  const web = loadEnv().PUBLIC_WEB_URL.replace(/\/$/, '')
  // Settings tabs are hash-based (#connections), query carries oauth flash flags.
  return `${web}/co/${encodeURIComponent(slug)}/settings?oauth=1#connections`
}

export function oauthFailRedirect(returnTo: string, error: string, provider?: string): string {
  const u = new URL(returnTo)
  u.searchParams.set('oauth_error', error.slice(0, 120))
  if (provider) u.searchParams.set('oauth_provider', provider)
  return u.toString()
}
