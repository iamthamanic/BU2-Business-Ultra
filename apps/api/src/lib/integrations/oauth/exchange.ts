/**
 * OAuth authorization-code → token exchange (Google / Microsoft / Meta).
 * Location: apps/api/src/lib/integrations/oauth/exchange.ts
 */
import type { IntegrationProvider } from '@bu2/shared'
import {
  getGoogleOAuthConfig,
  getMetaOAuthConfig,
  getMicrosoftOAuthConfig,
  GOOGLE_PROVIDER_SCOPES,
  OAUTH_SCOPES,
  scopesForProvider,
  type OAuthClientConfig,
} from './config.js'
import { oauthRedirectKey, oauthRedirectUri, type OAuthRedirectProvider } from './redirects.js'

export type ExchangedTokens = {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  scopes: string[]
  externalAccountId: string
  displayName: string
  accountType: string
  raw: Record<string, unknown>
}

function httpErr(message: string, statusCode = 502): Error {
  return Object.assign(new Error(message), { statusCode })
}

function parseExpires(expiresIn: unknown): Date | null {
  const n = typeof expiresIn === 'number' ? expiresIn : Number(expiresIn)
  if (!Number.isFinite(n) || n <= 0) return null
  return new Date(Date.now() + n * 1000)
}

function splitScopes(raw: unknown, fallback: string[]): string[] {
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
  }
  return [...fallback]
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return { raw: text }
  }
}

export async function exchangeGoogleCode(opts: {
  code: string
  codeVerifier: string
  redirectUri: string
  provider?: IntegrationProvider
  cfg?: OAuthClientConfig
}): Promise<ExchangedTokens> {
  const cfg = opts.cfg ?? getGoogleOAuthConfig()
  if (!cfg.configured) throw httpErr('google_oauth_not_configured', 503)
  const provider = opts.provider ?? 'google'

  const body = new URLSearchParams({
    code: opts.code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: opts.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: opts.codeVerifier,
  })
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const tokenJson = await readJson(tokenRes)
  if (!tokenRes.ok || typeof tokenJson.access_token !== 'string') {
    throw httpErr(`google_token_exchange_failed:${tokenRes.status}`)
  }

  const accessToken = tokenJson.access_token
  const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  const info = await readJson(infoRes)
  if (!infoRes.ok) throw httpErr(`google_userinfo_failed:${infoRes.status}`)

  const email = typeof info.email === 'string' ? info.email : ''
  const sub = typeof info.sub === 'string' ? info.sub : ''
  const name = typeof info.name === 'string' ? info.name.trim() : ''
  const fallbackScopes =
    provider === 'youtube' || provider === 'google_ads' || provider === 'google'
      ? GOOGLE_PROVIDER_SCOPES[provider]
      : OAUTH_SCOPES.google
  const scopes = splitScopes(tokenJson.scope, fallbackScopes)

  let externalAccountId = (email || sub).trim()
  let displayName = name || email || externalAccountId
  let accountType: string =
    provider === 'youtube' ? 'youtube' : provider === 'google_ads' ? 'google_ads' : 'gmail'
  const rawExtra: Record<string, unknown> = { info }

  if (provider === 'youtube') {
    const chRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      { headers: { authorization: `Bearer ${accessToken}` } },
    )
    const chJson = await readJson(chRes)
    rawExtra.channels = chJson
    const items = Array.isArray(chJson.items) ? chJson.items : []
    const first = items[0] as { id?: string; snippet?: { title?: string } } | undefined
    if (first?.id) {
      externalAccountId = first.id
      displayName = first.snippet?.title?.trim() || displayName
    } else if (!externalAccountId) {
      throw httpErr('youtube_channel_missing')
    }
  }

  if (!externalAccountId) throw httpErr('google_account_id_missing')

  return {
    accessToken,
    refreshToken: typeof tokenJson.refresh_token === 'string' ? tokenJson.refresh_token : null,
    expiresAt: parseExpires(tokenJson.expires_in),
    scopes,
    externalAccountId,
    displayName,
    accountType,
    raw: {
      token: { expires_in: tokenJson.expires_in, token_type: tokenJson.token_type },
      ...rawExtra,
    },
  }
}

export async function exchangeMicrosoftCode(opts: {
  code: string
  codeVerifier: string
  redirectUri: string
  cfg?: OAuthClientConfig
  tenant?: string
}): Promise<ExchangedTokens> {
  const cfg = opts.cfg ?? getMicrosoftOAuthConfig()
  if (!cfg.configured) throw httpErr('microsoft_oauth_not_configured', 503)
  const tenant = (opts.tenant || process.env.MICROSOFT_OAUTH_TENANT || 'common').trim() || 'common'

  const body = new URLSearchParams({
    code: opts.code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: opts.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: opts.codeVerifier,
    scope: OAUTH_SCOPES.microsoft.join(' '),
  })
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    },
  )
  const tokenJson = await readJson(tokenRes)
  if (!tokenRes.ok || typeof tokenJson.access_token !== 'string') {
    throw httpErr(`microsoft_token_exchange_failed:${tokenRes.status}`)
  }

  const accessToken = tokenJson.access_token
  const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  const me = await readJson(meRes)
  if (!meRes.ok) throw httpErr(`microsoft_me_failed:${meRes.status}`)

  const id = typeof me.id === 'string' ? me.id : ''
  const upn =
    (typeof me.userPrincipalName === 'string' && me.userPrincipalName) ||
    (typeof me.mail === 'string' && me.mail) ||
    ''
  const externalAccountId = (upn || id).trim()
  if (!externalAccountId) throw httpErr('microsoft_account_id_missing')

  const display =
    (typeof me.displayName === 'string' && me.displayName.trim()) || upn || externalAccountId

  return {
    accessToken,
    refreshToken: typeof tokenJson.refresh_token === 'string' ? tokenJson.refresh_token : null,
    expiresAt: parseExpires(tokenJson.expires_in),
    scopes: splitScopes(tokenJson.scope, OAUTH_SCOPES.microsoft),
    externalAccountId,
    displayName: display,
    accountType: 'outlook',
    raw: { token: { expires_in: tokenJson.expires_in, token_type: tokenJson.token_type }, me },
  }
}

export async function exchangeMetaCode(opts: {
  code: string
  redirectUri: string
  provider: IntegrationProvider
  cfg?: OAuthClientConfig
}): Promise<ExchangedTokens> {
  const cfg = opts.cfg ?? getMetaOAuthConfig()
  if (!cfg.configured) throw httpErr('meta_oauth_not_configured', 503)

  const shortUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token')
  shortUrl.searchParams.set('client_id', cfg.clientId)
  shortUrl.searchParams.set('client_secret', cfg.clientSecret)
  shortUrl.searchParams.set('redirect_uri', opts.redirectUri)
  shortUrl.searchParams.set('code', opts.code)

  const shortRes = await fetch(shortUrl)
  const shortJson = await readJson(shortRes)
  if (!shortRes.ok || typeof shortJson.access_token !== 'string') {
    throw httpErr(`meta_token_exchange_failed:${shortRes.status}`)
  }

  let accessToken = shortJson.access_token
  let expiresAt = parseExpires(shortJson.expires_in)

  // Upgrade to long-lived user token when possible.
  const longUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token')
  longUrl.searchParams.set('grant_type', 'fb_exchange_token')
  longUrl.searchParams.set('client_id', cfg.clientId)
  longUrl.searchParams.set('client_secret', cfg.clientSecret)
  longUrl.searchParams.set('fb_exchange_token', accessToken)
  const longRes = await fetch(longUrl)
  const longJson = await readJson(longRes)
  if (longRes.ok && typeof longJson.access_token === 'string') {
    accessToken = longJson.access_token
    expiresAt = parseExpires(longJson.expires_in) ?? expiresAt
  }

  const meRes = await fetch(
    `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`,
  )
  const me = await readJson(meRes)
  if (!meRes.ok || typeof me.id !== 'string' || !me.id) {
    throw httpErr(`meta_me_failed:${meRes.status}`)
  }

  const accountType =
    opts.provider === 'instagram'
      ? 'instagram'
      : opts.provider === 'whatsapp'
        ? 'whatsapp'
        : opts.provider === 'facebook'
          ? 'facebook'
          : opts.provider === 'meta_ads'
            ? 'meta_ads'
            : 'meta'

  return {
    accessToken,
    refreshToken: null,
    expiresAt,
    scopes: scopesForProvider(opts.provider),
    externalAccountId: me.id,
    displayName: (typeof me.name === 'string' && me.name.trim()) || me.id,
    accountType,
    raw: { me },
  }
}

/** Dispatch by redirect bucket + catalog provider. */
export async function exchangeOAuthCode(opts: {
  redirectKey: OAuthRedirectProvider
  provider: IntegrationProvider
  code: string
  codeVerifier: string | null
  redirectUri?: string
}): Promise<ExchangedTokens> {
  const redirectUri = opts.redirectUri ?? oauthRedirectUri(opts.redirectKey)
  if (opts.redirectKey === 'google') {
    if (!opts.codeVerifier) throw httpErr('pkce_verifier_missing', 400)
    return exchangeGoogleCode({
      code: opts.code,
      codeVerifier: opts.codeVerifier,
      redirectUri,
      provider: opts.provider,
    })
  }
  if (opts.redirectKey === 'microsoft') {
    if (!opts.codeVerifier) throw httpErr('pkce_verifier_missing', 400)
    return exchangeMicrosoftCode({
      code: opts.code,
      codeVerifier: opts.codeVerifier,
      redirectUri,
    })
  }
  return exchangeMetaCode({
    code: opts.code,
    redirectUri,
    provider: opts.provider,
  })
}
