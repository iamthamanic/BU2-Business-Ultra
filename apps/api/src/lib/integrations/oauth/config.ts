/**
 * OAuth client env — fail-closed until credentials are set.
 * Location: apps/api/src/lib/integrations/oauth/config.ts
 */
import type { IntegrationProvider } from '@bu2/shared'
import { oauthRedirectKey, type OAuthRedirectProvider } from './redirects.js'

function trimEnv(name: string): string {
  return (process.env[name] || '').trim()
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

/** Scopes reserved for when token exchange is wired. */
export const OAUTH_SCOPES: Record<OAuthRedirectProvider, string[]> = {
  google: [
    'openid',
    'email',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
  ],
  microsoft: ['openid', 'email', 'offline_access', 'Mail.ReadWrite', 'Mail.Send'],
  meta: [
    'pages_messaging',
    'instagram_basic',
    'instagram_manage_messages',
    'whatsapp_business_management',
    'whatsapp_business_messaging',
  ],
}
