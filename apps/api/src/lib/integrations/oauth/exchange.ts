/**
 * OAuth authorization-code → token exchange (Google / Microsoft / Meta / LinkedIn / TikTok / X / Pinterest).
 * Location: apps/api/src/lib/integrations/oauth/exchange.ts
 */
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
  GOOGLE_PROVIDER_SCOPES,
  OAUTH_SCOPES,
  normalizeMicrosoftTenant,
  scopesForProvider,
  type OAuthClientConfig,
} from './config.js'
import { oauthRedirectUri, type OAuthRedirectProvider } from './redirects.js'

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

/** Decode JWT payload claims without verifying signature (token just issued to us). */
function jwtPayloadClaims(token: string): Record<string, unknown> {
  const parts = token.split('.')
  if (parts.length < 2) return {}
  try {
    const json = Buffer.from(parts[1]!, 'base64url').toString('utf8')
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return {}
  }
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
  provider?: IntegrationProvider
  cfg?: OAuthClientConfig
  tenant?: string
}): Promise<ExchangedTokens> {
  const cfg = opts.cfg ?? getMicrosoftOAuthConfig()
  if (!cfg.configured) throw httpErr('microsoft_oauth_not_configured', 503)
  const tenant = normalizeMicrosoftTenant(opts.tenant || process.env.MICROSOFT_OAUTH_TENANT)
  const provider = opts.provider ?? 'microsoft'
  const scopes = scopesForProvider(provider)

  const body = new URLSearchParams({
    code: opts.code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: opts.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: opts.codeVerifier,
    scope: scopes.join(' '),
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
  // Microsoft Ads tokens may lack Graph Mail scopes — fall back to oid claim / opaque id.
  const id = typeof me.id === 'string' ? me.id : ''
  const upn =
    (typeof me.userPrincipalName === 'string' && me.userPrincipalName) ||
    (typeof me.mail === 'string' && me.mail) ||
    ''
  let externalAccountId = (upn || id).trim()
  let display =
    (typeof me.displayName === 'string' && me.displayName.trim()) || upn || externalAccountId

  if (!meRes.ok || !externalAccountId) {
    if (provider === 'microsoft_ads') {
      // Prefer stable Azure AD subject — never derive id from bearer token bytes.
      const claims = jwtPayloadClaims(accessToken)
      const oid = typeof claims.oid === 'string' ? claims.oid.trim() : ''
      const tid = typeof claims.tid === 'string' ? claims.tid.trim() : ''
      if (!oid) throw httpErr('microsoft_ads_account_id_missing')
      externalAccountId = tid ? `${tid}:${oid}` : oid
      display = 'Microsoft Ads'
    } else {
      throw httpErr(`microsoft_me_failed:${meRes.status}`)
    }
  }

  return {
    accessToken,
    refreshToken: typeof tokenJson.refresh_token === 'string' ? tokenJson.refresh_token : null,
    expiresAt: parseExpires(tokenJson.expires_in),
    scopes: splitScopes(tokenJson.scope, scopes),
    externalAccountId,
    displayName: display,
    accountType: provider === 'microsoft_ads' ? 'microsoft_ads' : 'outlook',
    raw: {
      token: { expires_in: tokenJson.expires_in, token_type: tokenJson.token_type },
      me: meRes.ok ? me : { skipped: true, status: meRes.status },
    },
  }
}

export async function exchangeRedditCode(opts: {
  code: string
  redirectUri: string
  codeVerifier?: string | null
  cfg?: OAuthClientConfig
}): Promise<ExchangedTokens> {
  const cfg = opts.cfg ?? getRedditOAuthConfig()
  if (!cfg.configured) throw httpErr('reddit_oauth_not_configured', 503)

  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    redirect_uri: opts.redirectUri,
  })
  if (opts.codeVerifier) body.set('code_verifier', opts.codeVerifier)
  const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${basic}`,
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': 'business-ultra/2.0 (reddit_ads oauth)',
    },
    body,
  })
  const tokenJson = await readJson(tokenRes)
  if (!tokenRes.ok || typeof tokenJson.access_token !== 'string') {
    throw httpErr(`reddit_token_exchange_failed:${tokenRes.status}`)
  }

  const accessToken = tokenJson.access_token
  const meRes = await fetch('https://oauth.reddit.com/api/v1/me', {
    headers: {
      authorization: `Bearer ${accessToken}`,
      'user-agent': 'business-ultra/2.0 (reddit_ads oauth)',
    },
  })
  const me = await readJson(meRes)
  if (!meRes.ok) throw httpErr(`reddit_me_failed:${meRes.status}`)

  const name = typeof me.name === 'string' ? me.name.trim() : ''
  const id = typeof me.id === 'string' ? me.id : ''
  const externalAccountId = (name || id).trim()
  if (!externalAccountId) throw httpErr('reddit_account_id_missing')

  return {
    accessToken,
    refreshToken: typeof tokenJson.refresh_token === 'string' ? tokenJson.refresh_token : null,
    expiresAt: parseExpires(tokenJson.expires_in),
    scopes: splitScopes(tokenJson.scope, scopesForProvider('reddit_ads')),
    externalAccountId,
    displayName: name || externalAccountId,
    accountType: 'reddit_ads',
    raw: { me },
  }
}

export async function exchangeChatGptAdsCode(opts: {
  code: string
  codeVerifier: string
  redirectUri: string
  cfg?: OAuthClientConfig
}): Promise<ExchangedTokens> {
  const cfg = opts.cfg ?? getChatGptAdsOAuthConfig()
  if (!cfg.configured) throw httpErr('chatgpt_ads_oauth_not_configured', 503)

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code_verifier: opts.codeVerifier,
  })
  const tokenRes = await fetch('https://auth.openai.com/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const tokenJson = await readJson(tokenRes)
  if (!tokenRes.ok || typeof tokenJson.access_token !== 'string') {
    throw httpErr(`chatgpt_ads_token_exchange_failed:${tokenRes.status}`)
  }

  const accessToken = tokenJson.access_token
  let externalAccountId = ''
  let displayName = 'ChatGPT Ads'

  try {
    const meRes = await fetch('https://api.openai.com/v1/me', {
      headers: { authorization: `Bearer ${accessToken}` },
    })
    if (meRes.ok) {
      const me = await readJson(meRes)
      const id = typeof me.id === 'string' ? me.id : ''
      const email = typeof me.email === 'string' ? me.email : ''
      if (id || email) {
        externalAccountId = (email || id).trim()
        displayName = email || id
      }
    }
  } catch {
    // Fall through to id_token / access-token claims.
  }

  if (!externalAccountId) {
    const idToken = typeof tokenJson.id_token === 'string' ? tokenJson.id_token : ''
    const claims = jwtPayloadClaims(idToken || accessToken)
    const sub = typeof claims.sub === 'string' ? claims.sub.trim() : ''
    const email = typeof claims.email === 'string' ? claims.email.trim() : ''
    externalAccountId = (email || sub).trim()
    if (email) displayName = email
  }
  // Fail closed — static ids would upsert/overwrite sealed tokens across reconnects.
  if (!externalAccountId) throw httpErr('chatgpt_ads_account_id_missing')

  return {
    accessToken,
    refreshToken: typeof tokenJson.refresh_token === 'string' ? tokenJson.refresh_token : null,
    expiresAt: parseExpires(tokenJson.expires_in),
    scopes: splitScopes(tokenJson.scope, scopesForProvider('chatgpt_ads')),
    externalAccountId,
    displayName,
    accountType: 'chatgpt_ads',
    raw: { token: { expires_in: tokenJson.expires_in, token_type: tokenJson.token_type } },
  }
}

/** Instagram API with Instagram Login — code exchange + long-lived IG token. */
async function exchangeInstagramBusinessCode(opts: {
  code: string
  redirectUri: string
  cfg: OAuthClientConfig
}): Promise<ExchangedTokens> {
  const body = new URLSearchParams({
    client_id: opts.cfg.clientId,
    client_secret: opts.cfg.clientSecret,
    grant_type: 'authorization_code',
    redirect_uri: opts.redirectUri,
    code: opts.code,
  })
  const shortRes = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const shortJson = await readJson(shortRes)
  if (!shortRes.ok || typeof shortJson.access_token !== 'string') {
    throw httpErr(`instagram_token_exchange_failed:${shortRes.status}`)
  }

  let accessToken = shortJson.access_token
  let expiresAt = parseExpires(shortJson.expires_in)

  const longUrl = new URL('https://graph.instagram.com/access_token')
  longUrl.searchParams.set('grant_type', 'ig_exchange_token')
  longUrl.searchParams.set('client_secret', opts.cfg.clientSecret)
  longUrl.searchParams.set('access_token', accessToken)
  const longRes = await fetch(longUrl)
  const longJson = await readJson(longRes)
  if (longRes.ok && typeof longJson.access_token === 'string') {
    accessToken = longJson.access_token
    expiresAt = parseExpires(longJson.expires_in) ?? expiresAt
  }

  const meRes = await fetch('https://graph.instagram.com/v21.0/me?fields=user_id,username,name', {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  const me = await readJson(meRes)
  const userId =
    (typeof me.user_id === 'string' && me.user_id) ||
    (typeof me.user_id === 'number' && String(me.user_id)) ||
    (typeof me.id === 'string' && me.id) ||
    (typeof shortJson.user_id === 'string' && shortJson.user_id) ||
    (typeof shortJson.user_id === 'number' && String(shortJson.user_id)) ||
    ''
  if (!meRes.ok || !userId) {
    throw httpErr(`instagram_me_failed:${meRes.status}`)
  }
  const username = typeof me.username === 'string' ? me.username.trim() : ''
  const name = typeof me.name === 'string' ? me.name.trim() : ''

  return {
    accessToken,
    refreshToken: null,
    expiresAt,
    scopes: scopesForProvider('instagram'),
    externalAccountId: userId,
    displayName: username || name || userId,
    accountType: 'instagram',
    raw: { me, short: shortJson },
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

  if (opts.provider === 'instagram') {
    const ig = opts.cfg ?? getInstagramOAuthConfig()
    if (!ig.configured) throw httpErr('meta_oauth_not_configured', 503)
    return exchangeInstagramBusinessCode({
      code: opts.code,
      redirectUri: opts.redirectUri,
      cfg: ig,
    })
  }

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

  const meRes = await fetch('https://graph.facebook.com/v21.0/me?fields=id,name', {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  const me = await readJson(meRes)
  if (!meRes.ok || typeof me.id !== 'string' || !me.id) {
    throw httpErr(`meta_me_failed:${meRes.status}`)
  }

  const accountType =
    opts.provider === 'whatsapp'
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

export async function exchangeLinkedInCode(opts: {
  code: string
  redirectUri: string
  codeVerifier?: string | null
  cfg?: OAuthClientConfig
}): Promise<ExchangedTokens> {
  const cfg = opts.cfg ?? getLinkedInOAuthConfig()
  if (!cfg.configured) throw httpErr('linkedin_oauth_not_configured', 503)

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  })
  if (opts.codeVerifier) body.set('code_verifier', opts.codeVerifier)
  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const tokenJson = await readJson(tokenRes)
  if (!tokenRes.ok || typeof tokenJson.access_token !== 'string') {
    throw httpErr(`linkedin_token_exchange_failed:${tokenRes.status}`)
  }

  const accessToken = tokenJson.access_token
  const infoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  const info = await readJson(infoRes)
  if (!infoRes.ok) throw httpErr(`linkedin_userinfo_failed:${infoRes.status}`)

  const sub = typeof info.sub === 'string' ? info.sub : ''
  const name = typeof info.name === 'string' ? info.name.trim() : ''
  const email = typeof info.email === 'string' ? info.email : ''

  return {
    accessToken,
    refreshToken: typeof tokenJson.refresh_token === 'string' ? tokenJson.refresh_token : null,
    expiresAt: parseExpires(tokenJson.expires_in),
    scopes: splitScopes(tokenJson.scope, scopesForProvider('linkedin')),
    externalAccountId: (sub || email).trim() || 'linkedin',
    displayName: name || email || sub || 'LinkedIn',
    accountType: 'linkedin',
    raw: { info },
  }
}

export async function exchangeTikTokCode(opts: {
  code: string
  codeVerifier: string
  redirectUri: string
  provider?: IntegrationProvider
  cfg?: OAuthClientConfig
}): Promise<ExchangedTokens> {
  const cfg = opts.cfg ?? getTikTokOAuthConfig()
  if (!cfg.configured) throw httpErr('tiktok_oauth_not_configured', 503)
  const provider = opts.provider ?? 'tiktok'

  const body = new URLSearchParams({
    client_key: cfg.clientId,
    client_secret: cfg.clientSecret,
    code: opts.code,
    grant_type: 'authorization_code',
    redirect_uri: opts.redirectUri,
    code_verifier: opts.codeVerifier,
  })
  const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const tokenJson = await readJson(tokenRes)
  const data =
    tokenJson.data && typeof tokenJson.data === 'object'
      ? (tokenJson.data as Record<string, unknown>)
      : tokenJson
  if (!tokenRes.ok || typeof data.access_token !== 'string') {
    throw httpErr(`tiktok_token_exchange_failed:${tokenRes.status}`)
  }

  const accessToken = data.access_token
  const openId = typeof data.open_id === 'string' ? data.open_id : ''
  let displayName = openId || 'TikTok'

  try {
    const meRes = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url',
      { headers: { authorization: `Bearer ${accessToken}` } },
    )
    const meJson = await readJson(meRes)
    const user =
      meJson.data &&
      typeof meJson.data === 'object' &&
      (meJson.data as { user?: Record<string, unknown> }).user
        ? ((meJson.data as { user: Record<string, unknown> }).user)
        : null
    if (user && typeof user.display_name === 'string' && user.display_name.trim()) {
      displayName = user.display_name.trim()
    }
  } catch {
    // Profile optional — tokens still usable
  }

  return {
    accessToken,
    refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : null,
    expiresAt: parseExpires(data.expires_in),
    scopes: splitScopes(data.scope, scopesForProvider(provider)),
    externalAccountId: openId || displayName,
    displayName,
    accountType: provider === 'tiktok_ads' ? 'tiktok_ads' : 'tiktok',
    raw: { token: data },
  }
}

export async function exchangeXCode(opts: {
  code: string
  codeVerifier: string
  redirectUri: string
  cfg?: OAuthClientConfig
}): Promise<ExchangedTokens> {
  const cfg = opts.cfg ?? getXOAuthConfig()
  if (!cfg.configured) throw httpErr('x_oauth_not_configured', 503)

  const body = new URLSearchParams({
    code: opts.code,
    grant_type: 'authorization_code',
    redirect_uri: opts.redirectUri,
    code_verifier: opts.codeVerifier,
    client_id: cfg.clientId,
  })
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')
  const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${basic}`,
    },
    body,
  })
  const tokenJson = await readJson(tokenRes)
  if (!tokenRes.ok || typeof tokenJson.access_token !== 'string') {
    throw httpErr(`x_token_exchange_failed:${tokenRes.status}`)
  }

  const accessToken = tokenJson.access_token
  const meRes = await fetch('https://api.twitter.com/2/users/me?user.fields=name,username', {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  const meJson = await readJson(meRes)
  const user =
    meJson.data && typeof meJson.data === 'object'
      ? (meJson.data as Record<string, unknown>)
      : null
  if (!meRes.ok || !user || typeof user.id !== 'string') {
    throw httpErr(`x_me_failed:${meRes.status}`)
  }
  const username = typeof user.username === 'string' ? user.username : ''
  const name = typeof user.name === 'string' ? user.name.trim() : ''

  return {
    accessToken,
    refreshToken: typeof tokenJson.refresh_token === 'string' ? tokenJson.refresh_token : null,
    expiresAt: parseExpires(tokenJson.expires_in),
    scopes: splitScopes(tokenJson.scope, scopesForProvider('x')),
    externalAccountId: user.id,
    displayName: username ? `@${username}` : name || user.id,
    accountType: 'x',
    raw: { user },
  }
}

export async function exchangePinterestCode(opts: {
  code: string
  redirectUri: string
  provider?: IntegrationProvider
  cfg?: OAuthClientConfig
}): Promise<ExchangedTokens> {
  const cfg = opts.cfg ?? getPinterestOAuthConfig()
  if (!cfg.configured) throw httpErr('pinterest_oauth_not_configured', 503)
  const provider = opts.provider ?? 'pinterest'

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    redirect_uri: opts.redirectUri,
  })
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')
  const tokenRes = await fetch('https://api.pinterest.com/v5/oauth/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${basic}`,
    },
    body,
  })
  const tokenJson = await readJson(tokenRes)
  if (!tokenRes.ok || typeof tokenJson.access_token !== 'string') {
    throw httpErr(`pinterest_token_exchange_failed:${tokenRes.status}`)
  }

  const accessToken = tokenJson.access_token
  let externalAccountId = 'pinterest'
  let displayName = 'Pinterest'
  try {
    const meRes = await fetch('https://api.pinterest.com/v5/user_account', {
      headers: { authorization: `Bearer ${accessToken}` },
    })
    const me = await readJson(meRes)
    if (meRes.ok) {
      if (typeof me.username === 'string' && me.username.trim()) {
        displayName = me.username.trim()
        externalAccountId = me.username.trim()
      }
      if (typeof me.id === 'string' && me.id) externalAccountId = me.id
    }
  } catch {
    // optional
  }

  return {
    accessToken,
    refreshToken: typeof tokenJson.refresh_token === 'string' ? tokenJson.refresh_token : null,
    expiresAt: parseExpires(tokenJson.expires_in),
    scopes: splitScopes(tokenJson.scope, scopesForProvider(provider)),
    externalAccountId,
    displayName,
    accountType: provider === 'pinterest_ads' ? 'pinterest_ads' : 'pinterest',
    raw: { token: tokenJson },
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
      provider: opts.provider,
    })
  }
  if (opts.redirectKey === 'linkedin') {
    if (!opts.codeVerifier) throw httpErr('pkce_verifier_missing', 400)
    return exchangeLinkedInCode({
      code: opts.code,
      redirectUri,
      codeVerifier: opts.codeVerifier,
    })
  }
  if (opts.redirectKey === 'tiktok') {
    if (!opts.codeVerifier) throw httpErr('pkce_verifier_missing', 400)
    return exchangeTikTokCode({
      code: opts.code,
      codeVerifier: opts.codeVerifier,
      redirectUri,
      provider: opts.provider,
    })
  }
  if (opts.redirectKey === 'x') {
    if (!opts.codeVerifier) throw httpErr('pkce_verifier_missing', 400)
    return exchangeXCode({
      code: opts.code,
      codeVerifier: opts.codeVerifier,
      redirectUri,
    })
  }
  if (opts.redirectKey === 'pinterest') {
    return exchangePinterestCode({
      code: opts.code,
      redirectUri,
      provider: opts.provider,
    })
  }
  if (opts.redirectKey === 'reddit') {
    if (!opts.codeVerifier) throw httpErr('pkce_verifier_missing', 400)
    return exchangeRedditCode({
      code: opts.code,
      redirectUri,
      codeVerifier: opts.codeVerifier,
    })
  }
  if (opts.redirectKey === 'chatgpt') {
    if (!opts.codeVerifier) throw httpErr('pkce_verifier_missing', 400)
    return exchangeChatGptAdsCode({
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
