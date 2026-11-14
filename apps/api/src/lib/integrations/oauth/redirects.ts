/**
 * OAuth redirect URIs — one fixed callback per provider family per deployment (PUBLIC_API_URL).
 * Tenant/firma is carried in signed OAuth `state`, not in the path.
 * Location: apps/api/src/lib/integrations/oauth/redirects.ts
 */
import type { IntegrationProvider } from '@bu2/shared'
import { loadEnv } from '../../env.js'

/** Shared OAuth redirect buckets (one Developer Console app / callback each). */
export type OAuthRedirectProvider =
  | 'google'
  | 'microsoft'
  | 'meta'
  | 'linkedin'
  | 'tiktok'
  | 'x'
  | 'pinterest'
  | 'reddit'
  | 'chatgpt'

const REDIRECT_PATH: Record<OAuthRedirectProvider, string> = {
  google: '/api/oauth/google/callback',
  microsoft: '/api/oauth/microsoft/callback',
  meta: '/api/oauth/meta/callback',
  linkedin: '/api/oauth/linkedin/callback',
  tiktok: '/api/oauth/tiktok/callback',
  x: '/api/oauth/x/callback',
  pinterest: '/api/oauth/pinterest/callback',
  reddit: '/api/oauth/reddit/callback',
  chatgpt: '/api/oauth/chatgpt/callback',
}

/** Map catalog provider id → OAuth redirect bucket. */
export function oauthRedirectKey(
  provider: IntegrationProvider | string,
): OAuthRedirectProvider | null {
  // Gmail + YouTube + Google Ads share one Google Cloud OAuth client / callback.
  if (provider === 'google' || provider === 'youtube' || provider === 'google_ads') return 'google'
  // Outlook + Microsoft Ads share one Azure AD app / callback.
  if (provider === 'microsoft' || provider === 'microsoft_ads') return 'microsoft'
  if (
    provider === 'whatsapp' ||
    provider === 'instagram' ||
    provider === 'facebook' ||
    provider === 'meta' ||
    provider === 'meta_ads'
  ) {
    return 'meta'
  }
  if (provider === 'linkedin') return 'linkedin'
  if (provider === 'tiktok' || provider === 'tiktok_ads') return 'tiktok'
  if (provider === 'x') return 'x'
  if (provider === 'pinterest' || provider === 'pinterest_ads') return 'pinterest'
  if (provider === 'reddit_ads') return 'reddit'
  if (provider === 'chatgpt_ads') return 'chatgpt'
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
    linkedin: oauthRedirectUri('linkedin'),
    tiktok: oauthRedirectUri('tiktok'),
    x: oauthRedirectUri('x'),
    pinterest: oauthRedirectUri('pinterest'),
    reddit: oauthRedirectUri('reddit'),
    chatgpt: oauthRedirectUri('chatgpt'),
  }
}

export const OAUTH_CALLBACK_PROVIDERS = Object.keys(REDIRECT_PATH) as OAuthRedirectProvider[]
