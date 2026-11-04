/**
 * Signed OAuth state — binds callback to business/user without per-tenant redirect URIs.
 * Location: apps/api/src/lib/integrations/oauth/state.ts
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { IntegrationProvider } from '@bu2/shared'
import { loadEnv } from '../../env.js'

export type OAuthStatePayload = {
  v: 1
  provider: IntegrationProvider
  businessId: string
  slug: string
  userId: string
  nonce: string
  exp: number
}

const TTL_MS = 15 * 60 * 1000

function sign(body: string): string {
  return createHmac('sha256', loadEnv().SESSION_SECRET).update(body).digest('base64url')
}

export function createOAuthState(input: {
  provider: IntegrationProvider
  businessId: string
  slug: string
  userId: string
}): string {
  const payload: OAuthStatePayload = {
    v: 1,
    provider: input.provider,
    businessId: input.businessId,
    slug: input.slug,
    userId: input.userId,
    nonce: randomBytes(16).toString('hex'),
    exp: Date.now() + TTL_MS,
  }
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${body}.${sign(body)}`
}

export function parseOAuthState(raw: string): OAuthStatePayload {
  const [body, sig] = raw.split('.')
  if (!body || !sig) {
    throw Object.assign(new Error('oauth_state_invalid'), { statusCode: 400 })
  }
  const expected = sign(body)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw Object.assign(new Error('oauth_state_tampered'), { statusCode: 400 })
  }
  let payload: OAuthStatePayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as OAuthStatePayload
  } catch {
    throw Object.assign(new Error('oauth_state_invalid'), { statusCode: 400 })
  }
  if (payload.v !== 1 || !payload.provider || !payload.businessId || !payload.slug) {
    throw Object.assign(new Error('oauth_state_invalid'), { statusCode: 400 })
  }
  if (Date.now() > payload.exp) {
    throw Object.assign(new Error('oauth_state_expired'), { statusCode: 400 })
  }
  return payload
}
