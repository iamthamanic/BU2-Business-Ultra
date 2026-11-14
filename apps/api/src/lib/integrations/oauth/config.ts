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

/** Azure AD tenant path segment — allowlist aliases or a GUID. */
export function normalizeMicrosoftTenant(raw: string | undefined): string {
  const t = (raw || 'common').trim().toLowerCase() || 'common'
  if (t === 'common' || t === 'organizations' || t === 'consumers') return t
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return t
  throw Object.assign(new Error('microsoft_oauth_tenant_invalid'), { statusCode: 503 })
}

export function getMetaOAuthConfig(): OAuthClientConfig {
  const clientId = trimEnv('META_OAUTH_APP_ID')
  const clientSecret = trimEnv('META_OAUTH_APP_SECRET')
  return { clientId, clientSecret, configured: Boolean(clientId && clientSecret) }
}

/**
 * Instagram Business Login credentials from
 * App Dashboard → Instagram → API setup with Instagram login → Business login settings.
 * Falls back to Meta app id/secret when Instagram-specific env is unset.
 */
export function getInstagramOAuthConfig(): OAuthClientConfig {
  const igId = trimEnv('META_INSTAGRAM_APP_ID')
  const igSecret = trimEnv('META_INSTAGRAM_APP_SECRET')
  if (igId && igSecret) {
    return { clientId: igId, clientSecret: igSecret, configured: true }
  }
  return getMetaOAuthConfig()
}

export function getLinkedInOAuthConfig(): OAuthClientConfig {
  const clientId = trimEnv('LINKEDIN_OAUTH_CLIENT_ID')
  const clientSecret = trimEnv('LINKEDIN_OAUTH_CLIENT_SECRET')
  return { clientId, clientSecret, configured: Boolean(clientId && clientSecret) }
}

/** TikTok uses client_key / client_secret naming in their console. */
export function getTikTokOAuthConfig(): OAuthClientConfig {
  const clientId = trimEnv('TIKTOK_OAUTH_CLIENT_KEY')
  const clientSecret = trimEnv('TIKTOK_OAUTH_CLIENT_SECRET')
  return { clientId, clientSecret, configured: Boolean(clientId && clientSecret) }
}

export function getXOAuthConfig(): OAuthClientConfig {
  const clientId = trimEnv('X_OAUTH_CLIENT_ID')
  const clientSecret = trimEnv('X_OAUTH_CLIENT_SECRET')
  return { clientId, clientSecret, configured: Boolean(clientId && clientSecret) }
}

export function getPinterestOAuthConfig(): OAuthClientConfig {
  const clientId = trimEnv('PINTEREST_OAUTH_CLIENT_ID')
  const clientSecret = trimEnv('PINTEREST_OAUTH_CLIENT_SECRET')
  return { clientId, clientSecret, configured: Boolean(clientId && clientSecret) }
}

export function getRedditOAuthConfig(): OAuthClientConfig {
  const clientId = trimEnv('REDDIT_OAUTH_CLIENT_ID')
  const clientSecret = trimEnv('REDDIT_OAUTH_CLIENT_SECRET')
  return { clientId, clientSecret, configured: Boolean(clientId && clientSecret) }
}

/** OpenAI / ChatGPT Ads — platform OAuth app (Client ID/Secret). */
export function getChatGptAdsOAuthConfig(): OAuthClientConfig {
  const clientId = trimEnv('CHATGPT_ADS_CLIENT_ID')
  const clientSecret = trimEnv('CHATGPT_ADS_CLIENT_SECRET')
  return { clientId, clientSecret, configured: Boolean(clientId && clientSecret) }
}

export function oauthClientConfigured(key: OAuthRedirectProvider): boolean {
  if (key === 'google') return getGoogleOAuthConfig().configured
  if (key === 'microsoft') return getMicrosoftOAuthConfig().configured
  if (key === 'meta') return getMetaOAuthConfig().configured
  if (key === 'linkedin') return getLinkedInOAuthConfig().configured
  if (key === 'tiktok') return getTikTokOAuthConfig().configured
  if (key === 'x') return getXOAuthConfig().configured
  if (key === 'pinterest') return getPinterestOAuthConfig().configured
  if (key === 'reddit') return getRedditOAuthConfig().configured
  if (key === 'chatgpt') return getChatGptAdsOAuthConfig().configured
  return false
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

const META_PAGE_BASE = [
  'pages_show_list',
  'pages_messaging',
  'pages_manage_metadata',
  'pages_read_engagement',
  'business_management',
] as const

/** Instagram API with Instagram Login (graph.instagram.com). */
export const INSTAGRAM_BUSINESS_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
] as const

/** Per-channel Meta scopes (shared OAuth client / callback). */
export const META_PROVIDER_SCOPES: Record<
  'facebook' | 'instagram' | 'whatsapp' | 'meta',
  readonly string[]
> = {
  facebook: META_PAGE_BASE,
  instagram: INSTAGRAM_BUSINESS_SCOPES,
  whatsapp: [
    'business_management',
    'whatsapp_business_management',
    'whatsapp_business_messaging',
  ],
  meta: META_PAGE_BASE,
}

export const LINKEDIN_SCOPES = ['openid', 'profile', 'email', 'w_member_social'] as const

export const TIKTOK_SCOPES = [
  'user.info.basic',
  'video.list',
  'video.upload',
  'video.publish',
] as const

export const TIKTOK_ADS_SCOPES = ['user.info.basic', 'video.list'] as const

export const X_SCOPES = [
  'tweet.read',
  'tweet.write',
  'users.read',
  'offline.access',
] as const

export const PINTEREST_SCOPES = [
  'boards:read',
  'boards:write',
  'pins:read',
  'pins:write',
  'user_accounts:read',
] as const

/** Microsoft Advertising (Bing Ads) — same Azure AD client as Outlook. */
export const MICROSOFT_ADS_SCOPES = [
  'openid',
  'email',
  'offline_access',
  'https://ads.microsoft.com/msads.manage',
] as const

/** Reddit Ads / Marketing API. */
export const REDDIT_ADS_SCOPES = ['identity', 'adsread'] as const

/** OpenAI OAuth scopes for ChatGPT Ads connect. */
export const CHATGPT_ADS_SCOPES = ['openid', 'profile', 'email'] as const

/** Default scopes per redirect bucket (provider-specific overrides in scopesForProvider). */
export const OAUTH_SCOPES: Record<OAuthRedirectProvider, string[]> = {
  google: GOOGLE_PROVIDER_SCOPES.google,
  microsoft: ['openid', 'email', 'offline_access', 'Mail.ReadWrite', 'Mail.Send'],
  meta: [...META_PROVIDER_SCOPES.meta],
  linkedin: [...LINKEDIN_SCOPES],
  tiktok: [...TIKTOK_SCOPES],
  x: [...X_SCOPES],
  pinterest: [...PINTEREST_SCOPES],
  reddit: [...REDDIT_ADS_SCOPES],
  chatgpt: [...CHATGPT_ADS_SCOPES],
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
  if (
    provider === 'facebook' ||
    provider === 'instagram' ||
    provider === 'whatsapp' ||
    provider === 'meta'
  ) {
    return [...META_PROVIDER_SCOPES[provider]]
  }
  if (provider === 'linkedin') return [...LINKEDIN_SCOPES]
  if (provider === 'tiktok') return [...TIKTOK_SCOPES]
  if (provider === 'tiktok_ads') return [...TIKTOK_ADS_SCOPES]
  if (provider === 'x') return [...X_SCOPES]
  if (provider === 'pinterest' || provider === 'pinterest_ads') return [...PINTEREST_SCOPES]
  if (provider === 'microsoft_ads') return [...MICROSOFT_ADS_SCOPES]
  if (provider === 'reddit_ads') return [...REDDIT_ADS_SCOPES]
  if (provider === 'chatgpt_ads') return [...CHATGPT_ADS_SCOPES]
  const key = oauthRedirectKey(provider)
  return key ? OAUTH_SCOPES[key] : []
}
