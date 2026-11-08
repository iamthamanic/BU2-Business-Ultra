/**
 * OAuth client env — fail-closed until credentials are set.
 * Location: apps/api/src/lib/integrations/oauth/config.ts
 */
import type { IntegrationProvider } from '@bu2/shared'
import { oauthRedirectKey, type OAuthRedirectProvider } from './redirects.js'

function trimEnv(name: string): string {
  return process.env[name]?.trim() ?? ''
}

export type OAuthClientConfig = {
  clientId: string
  clientSecret: string
  configured: boolean
}

export function getGoogleOAuthConfig(): OAuthClientConfig {
  const clientId = trimEnv('GOOGLE_OAUTH_CLIENT_ID')
  const clientSecret = trimEnv('GOOGLE_OAUTH_CLIENT_SECRET')
  return { clientId, clientSecret, configured: Boolean(clientId && clientSecret) }
}

export function getMicrosoftOAuthConfig(): OAuthClientConfig {
  const clientId = trimEnv('MICROSOFT_OAUTH_CLIENT_ID')
  const clientSecret = trimEnv('MICROSOFT_OAUTH_CLIENT_SECRET')
  return { clientId, clientSecret, configured: Boolean(clientId && clientSecret) }
}

export function getMetaOAuthConfig(): OAuthClientConfig {
  const clientId = trimEnv('META_OAUTH_APP_ID')
  const clientSecret = trimEnv('META_OAUTH_APP_SECRET')
  return { clientId, clientSecret, configured: Boolean(clientId && clientSecret) }
}

export function oauthClientConfigured(key: OAuthRedirectProvider): boolean {
  if (key === 'google') return getGoogleOAuthConfig().configured
  if (key === 'microsoft') return getMicrosoftOAuthConfig().configured
  return getMetaOAuthConfig().configured
}

export function oauthClientConfiguredForProvider(provider: IntegrationProvider | string): boolean {
  const key = oauthRedirectKey(provider)
  return key ? oauthClientConfigured(key) : false
}

/** Google Cloud OAuth scopes by Integration Core provider (same client, different connects). */
export const GOOGLE_PROVIDER_SCOPES: Record<'google' | 'youtube' | 'google_ads', string[]> = {
  google: [
    'openid',
    'email',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
  ],
  youtube: [
    'openid',
    'email',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.force-ssl',
  ],
  google_ads: ['openid', 'email', 'https://www.googleapis.com/auth/adwords'],
}

/** Scopes for Meta / Microsoft redirect buckets; Google aliases GOOGLE_PROVIDER_SCOPES.google. */
export const OAUTH_SCOPES: Record<OAuthRedirectProvider, string[]> = {
  google: GOOGLE_PROVIDER_SCOPES.google,
  microsoft: ['openid', 'email', 'offline_access', 'Mail.ReadWrite', 'Mail.Send'],
  meta: [
    'pages_messaging',
    'instagram_basic',
    'instagram_manage_messages',
    'whatsapp_business_management',
    'whatsapp_business_messaging',
  ],
}

/** Meta Marketing API — separate connect from messaging channels. */
export const META_ADS_SCOPES = [
  'ads_read',
  'ads_management',
  'business_management',
  'pages_show_list',
] as const

export function scopesForProvider(provider: IntegrationProvider | string): string[] {
  if (provider === 'google' || provider === 'youtube' || provider === 'google_ads') {
    return GOOGLE_PROVIDER_SCOPES[provider]
  }
  if (provider === 'meta_ads') {
    return [...META_ADS_SCOPES]
  }
  const key = oauthRedirectKey(provider)
  return key ? OAUTH_SCOPES[key] : []
}
