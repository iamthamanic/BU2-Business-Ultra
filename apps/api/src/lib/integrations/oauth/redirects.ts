/**
 * OAuth redirect URIs — one fixed callback per provider per deployment (PUBLIC_API_URL).
 * Tenant/firma is carried in signed OAuth `state`, not in the path.
 * Location: apps/api/src/lib/integrations/oauth/redirects.ts
 */
import type { IntegrationProvider } from '@bu2/shared'
import { loadEnv } from '../../env.js'

/** Providers that use a shared OAuth redirect (Meta channels share one Meta app callback). */
export type OAuthRedirectProvider = 'google' | 'microsoft' | 'meta'

const REDIRECT_PATH: Record<OAuthRedirectProvider, string> = {
  google: '/api/oauth/google/callback',
  microsoft: '/api/oauth/microsoft/callback',
  meta: '/api/oauth/meta/callback',
}

/** Map catalog provider id → OAuth redirect bucket. */
export function oauthRedirectKey(
  provider: IntegrationProvider | string,
): OAuthRedirectProvider | null {
  // Gmail + YouTube + Google Ads share one Google Cloud OAuth client / callback.
  if (provider === 'google' || provider === 'youtube' || provider === 'google_ads') return 'google'
  if (provider === 'microsoft') return 'microsoft'
  if (
    provider === 'whatsapp' ||
    provider === 'instagram' ||
    provider === 'facebook' ||
    provider === 'meta' ||
    provider === 'meta_ads'
  ) {
    return 'meta'
  }
  return null
}

export function oauthRedirectUri(key: OAuthRedirectProvider): string {
  const base = loadEnv().PUBLIC_API_URL.replace(/\/$/, '')
  return `${base}${REDIRECT_PATH[key]}`
}

export function oauthRedirectUriForProvider(provider: IntegrationProvider | string): string | null {
  const key = oauthRedirectKey(provider)
  return key ? oauthRedirectUri(key) : null
}

export function allOauthRedirectUris(): Record<OAuthRedirectProvider, string> {
  return {
    google: oauthRedirectUri('google'),
    microsoft: oauthRedirectUri('microsoft'),
    meta: oauthRedirectUri('meta'),
  }
}
