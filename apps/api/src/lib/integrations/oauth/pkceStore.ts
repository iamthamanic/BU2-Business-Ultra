/**
 * PKCE verifier store — sealed HttpOnly cookie (multi-instance safe) + in-memory fallback for tests.
 * Cookie survives IdP top-level redirect (SameSite=Lax). Never put verifier in OAuth `state` URL.
 * Location: apps/api/src/lib/integrations/oauth/pkceStore.ts
 */
import { createHash } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { loadEnv } from '../../env.js'
import { openSecret, sealSecret } from '../../crypto.js'

const COOKIE = 'bu2_oauth_pkce'
const TTL_MS = 15 * 60 * 1000
const TTL_SEC = Math.floor(TTL_MS / 1000)

type Entry = { codeVerifier: string; exp: number }
const memory = new Map<string, Entry>()

function stateKey(state: string): string {
  return createHash('sha256').update(state).digest('base64url').slice(0, 32)
}

/** Test / single-process fallback when no reply cookie is set. */
export function putPkceVerifier(state: string, codeVerifier: string): void {
  memory.set(stateKey(state), { codeVerifier, exp: Date.now() + TTL_MS })
  if (memory.size > 500) {
    const now = Date.now()
    for (const [k, v] of memory) {
      if (now > v.exp) memory.delete(k)
    }
  }
}

export function takePkceVerifier(state: string): string | null {
  const key = stateKey(state)
  const e = memory.get(key)
  memory.delete(key)
  if (!e || Date.now() > e.exp) return null
  return e.codeVerifier
}

export function setPkceCookie(
  reply: FastifyReply,
  state: string,
  codeVerifier: string,
): void {
  putPkceVerifier(state, codeVerifier)
  const sealed = sealSecret(JSON.stringify({ k: stateKey(state), v: codeVerifier, exp: Date.now() + TTL_MS }))
  const value = `${sealed.iv}.${sealed.tag}.${sealed.ciphertext}`
  const env = loadEnv()
  const secure = env.NODE_ENV === 'production' || env.PUBLIC_API_URL.startsWith('https://')
  reply.setCookie(COOKIE, value, {
    path: '/api/oauth',
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: TTL_SEC,
    signed: false,
  })
}

export function takePkceFromRequest(req: FastifyRequest, reply: FastifyReply, state: string): string | null {
  const key = stateKey(state)
  const raw = req.cookies?.[COOKIE]
  reply.clearCookie(COOKIE, { path: '/api/oauth' })

  if (typeof raw === 'string' && raw.includes('.')) {
    try {
      const [iv, tag, ciphertext] = raw.split('.')
      if (iv && tag && ciphertext) {
        const json = openSecret(ciphertext, iv, tag)
        const parsed = JSON.parse(json) as { k?: string; v?: string; exp?: number }
        if (
          parsed.k === key &&
          typeof parsed.v === 'string' &&
          parsed.v &&
          typeof parsed.exp === 'number' &&
          Date.now() <= parsed.exp
        ) {
          memory.delete(key)
          return parsed.v
        }
      }
    } catch {
      // Fall through to memory.
    }
  }
  return takePkceVerifier(state)
}
