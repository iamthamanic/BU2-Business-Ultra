/**
 * Build provider authorize URLs (PKCE). Token exchange: oauth/exchange.ts + callback routes.
 * Location: apps/api/src/lib/integrations/oauth/authorize.ts
 */
import { createHash, randomBytes } from 'node:crypto'
import type { IntegrationProvider } from '@bu2/shared'
import {
  getChatGptAdsOAuthConfig,
  getGoogleOAuthConfig,
  getInstagramOAuthConfig,
  getLinkedInOAuthConfig,
  getMetaOAuthConfig,
  getMicrosoftOAuthConfig,
  getPinterestOAuthConfig,
  getRedditOAuthConfig,
  getTikTokOAuthConfig,
  getXOAuthConfig,
  normalizeMicrosoftTenant,
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
    const tenant = normalizeMicrosoftTenant(process.env.MICROSOFT_OAUTH_TENANT)
    const u = new URL(
      `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`,
    )
    u.searchParams.set('client_id', cfg.clientId)
    u.searchParams.set('redirect_uri', redirectUri)
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('scope', scopesForProvider(opts.provider).join(' '))
    u.searchParams.set('response_mode', 'query')
    u.searchParams.set('state', state)
    u.searchParams.set('code_challenge', challenge)
    u.searchParams.set('code_challenge_method', 'S256')
    return { authorizeUrl: u.toString(), state, codeVerifier: verifier, redirectUri }
  }

  if (key === 'reddit') {
    const cfg = getRedditOAuthConfig()
    if (!cfg.configured) {
      throw Object.assign(new Error('reddit_oauth_not_configured'), { statusCode: 503 })
    }
    const u = new URL('https://www.reddit.com/api/v1/authorize')
    u.searchParams.set('client_id', cfg.clientId)
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('state', state)
    u.searchParams.set('redirect_uri', redirectUri)
    u.searchParams.set('duration', 'permanent')
    u.searchParams.set('scope', scopesForProvider(opts.provider).join(' '))
    u.searchParams.set('code_challenge', challenge)
    u.searchParams.set('code_challenge_method', 'S256')
    return { authorizeUrl: u.toString(), state, codeVerifier: verifier, redirectUri }
  }

  if (key === 'chatgpt') {
    const cfg = getChatGptAdsOAuthConfig()
    if (!cfg.configured) {
      throw Object.assign(new Error('chatgpt_ads_oauth_not_configured'), { statusCode: 503 })
    }
    const u = new URL('https://auth.openai.com/oauth/authorize')
    u.searchParams.set('client_id', cfg.clientId)
    u.searchParams.set('redirect_uri', redirectUri)
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('scope', scopesForProvider(opts.provider).join(' '))
    u.searchParams.set('state', state)
    u.searchParams.set('code_challenge', challenge)
    u.searchParams.set('code_challenge_method', 'S256')
    return { authorizeUrl: u.toString(), state, codeVerifier: verifier, redirectUri }
  }

  if (key === 'linkedin') {
    const cfg = getLinkedInOAuthConfig()
    if (!cfg.configured) {
      throw Object.assign(new Error('linkedin_oauth_not_configured'), { statusCode: 503 })
    }
    const u = new URL('https://www.linkedin.com/oauth/v2/authorization')
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('client_id', cfg.clientId)
    u.searchParams.set('redirect_uri', redirectUri)
    u.searchParams.set('state', state)
    u.searchParams.set('scope', scopesForProvider(opts.provider).join(' '))
    u.searchParams.set('code_challenge', challenge)
    u.searchParams.set('code_challenge_method', 'S256')
    return { authorizeUrl: u.toString(), state, codeVerifier: verifier, redirectUri }
  }

  if (key === 'tiktok') {
    const cfg = getTikTokOAuthConfig()
    if (!cfg.configured) {
      throw Object.assign(new Error('tiktok_oauth_not_configured'), { statusCode: 503 })
    }
    const u = new URL('https://www.tiktok.com/v2/auth/authorize/')
    u.searchParams.set('client_key', cfg.clientId)
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('scope', scopesForProvider(opts.provider).join(','))
    u.searchParams.set('redirect_uri', redirectUri)
    u.searchParams.set('state', state)
    u.searchParams.set('code_challenge', challenge)
    u.searchParams.set('code_challenge_method', 'S256')
    return { authorizeUrl: u.toString(), state, codeVerifier: verifier, redirectUri }
  }

  if (key === 'x') {
    const cfg = getXOAuthConfig()
    if (!cfg.configured) {
      throw Object.assign(new Error('x_oauth_not_configured'), { statusCode: 503 })
    }
    const u = new URL('https://twitter.com/i/oauth2/authorize')
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('client_id', cfg.clientId)
    u.searchParams.set('redirect_uri', redirectUri)
    u.searchParams.set('scope', scopesForProvider(opts.provider).join(' '))
    u.searchParams.set('state', state)
    u.searchParams.set('code_challenge', challenge)
    u.searchParams.set('code_challenge_method', 'S256')
    return { authorizeUrl: u.toString(), state, codeVerifier: verifier, redirectUri }
  }

  if (key === 'pinterest') {
    const cfg = getPinterestOAuthConfig()
    if (!cfg.configured) {
      throw Object.assign(new Error('pinterest_oauth_not_configured'), { statusCode: 503 })
    }
    const u = new URL('https://www.pinterest.com/oauth/')
    u.searchParams.set('client_id', cfg.clientId)
    u.searchParams.set('redirect_uri', redirectUri)
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('scope', scopesForProvider(opts.provider).join(','))
    u.searchParams.set('state', state)
    return { authorizeUrl: u.toString(), state, codeVerifier: verifier, redirectUri }
  }

  // Meta (facebook / instagram / whatsapp / meta_ads)
  const cfg = getMetaOAuthConfig()
  if (!cfg.configured) {
    throw Object.assign(new Error('meta_oauth_not_configured'), { statusCode: 503 })
  }

  const configId = (process.env.META_OAUTH_CONFIG_ID || '').trim()
  const useLoginForBusiness =
    Boolean(configId) &&
    (opts.provider === 'instagram' ||
      opts.provider === 'facebook' ||
      opts.provider === 'meta' ||
      opts.provider === 'meta_ads')

  if (opts.provider === 'instagram' && !useLoginForBusiness) {
    const ig = getInstagramOAuthConfig()
    if (!ig.configured) {
      throw Object.assign(new Error('meta_oauth_not_configured'), { statusCode: 503 })
    }
    const u = new URL('https://www.instagram.com/oauth/authorize')
    u.searchParams.set('client_id', ig.clientId)
    u.searchParams.set('redirect_uri', redirectUri)
    u.searchParams.set('response_type', 'code')
    u.searchParams.set('scope', scopesForProvider('instagram').join(','))
    u.searchParams.set('state', state)
    return { authorizeUrl: u.toString(), state, codeVerifier: verifier, redirectUri }
  }

  const u = new URL('https://www.facebook.com/v21.0/dialog/oauth')
  u.searchParams.set('client_id', cfg.clientId)
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('state', state)
  u.searchParams.set('response_type', 'code')
  if (useLoginForBusiness) {
    u.searchParams.set('config_id', configId)
    u.searchParams.set('override_default_response_type', 'true')
    u.searchParams.set('prompt', 'login')
  } else {
    u.searchParams.set('scope', scopesForProvider(opts.provider).join(','))
  }
  return { authorizeUrl: u.toString(), state, codeVerifier: verifier, redirectUri }
}
