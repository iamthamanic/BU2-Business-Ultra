/**
 * Build provider authorize URLs (PKCE). Token exchange: oauth/exchange.ts + callback routes.
 * Location: apps/api/src/lib/integrations/oauth/authorize.ts
 */
import { createHash, randomBytes } from 'node:crypto'
import type { IntegrationProvider } from '@bu2/shared'
import {
  getGoogleOAuthConfig,
  getMetaOAuthConfig,
  getMicrosoftOAuthConfig,
  OAUTH_SCOPES,
  scopesForProvider,
} from './config.js'
import { oauthRedirectKey, oauthRedirectUri } from './redirects.js'
import { createOAuthState } from './state.js'

function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export type OAuthStartResult = {
  authorizeUrl: string
  state: string
  /** PKCE verifier — caller must stash server-side (cookie / pending table). */
  codeVerifier: string
  redirectUri: string
}

export function buildOAuthAuthorizeUrl(opts: {
  provider: IntegrationProvider
  businessId: string
  slug: string
  userId: string
}): OAuthStartResult {
  const key = oauthRedirectKey(opts.provider)
  if (!key) {
    throw Object.assign(new Error('oauth_not_supported'), { statusCode: 400 })
  }

  const redirectUri = oauthRedirectUri(key)
  const state = createOAuthState({
    provider: opts.provider,
    businessId: opts.businessId,
    slug: opts.slug,
    userId: opts.userId,
  })
  const { verifier, challenge } = pkcePair()

  if (key === 'google') {
    const cfg = getGoogleOAuthConfig()
    if (!cfg.configured) {
      throw Object.assign(new Error('google_oauth_not_configured'), { statusCode: 503 })
    }
    const u = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    u.searchParams.set('client_id', cfg.clientId)
    u.searchParams.set('redirect_uri', redirectUri)
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('scope', scopesForProvider(opts.provider).join(' '))
    u.searchParams.set('access_type', 'offline')
    u.searchParams.set('prompt', 'consent')
    u.searchParams.set('include_granted_scopes', 'true')
    u.searchParams.set('state', state)
    u.searchParams.set('code_challenge', challenge)
    u.searchParams.set('code_challenge_method', 'S256')
    return { authorizeUrl: u.toString(), state, codeVerifier: verifier, redirectUri }
  }

  if (key === 'microsoft') {
    const cfg = getMicrosoftOAuthConfig()
    if (!cfg.configured) {
      throw Object.assign(new Error('microsoft_oauth_not_configured'), { statusCode: 503 })
    }
    const tenant = (process.env.MICROSOFT_OAUTH_TENANT || 'common').trim() || 'common'
    const u = new URL(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`)
    u.searchParams.set('client_id', cfg.clientId)
    u.searchParams.set('redirect_uri', redirectUri)
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('scope', OAUTH_SCOPES.microsoft.join(' '))
    u.searchParams.set('response_mode', 'query')
    u.searchParams.set('state', state)
    u.searchParams.set('code_challenge', challenge)
    u.searchParams.set('code_challenge_method', 'S256')
    return { authorizeUrl: u.toString(), state, codeVerifier: verifier, redirectUri }
  }

  const cfg = getMetaOAuthConfig()
  if (!cfg.configured) {
    throw Object.assign(new Error('meta_oauth_not_configured'), { statusCode: 503 })
  }
  const u = new URL('https://www.facebook.com/v21.0/dialog/oauth')
  u.searchParams.set('client_id', cfg.clientId)
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('state', state)
  u.searchParams.set('scope', scopesForProvider(opts.provider).join(','))
  // Meta dialog does not use PKCE the same way; keep verifier for future Graph token steps.
  return { authorizeUrl: u.toString(), state, codeVerifier: verifier, redirectUri }
}
