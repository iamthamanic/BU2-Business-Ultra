/**
 * Short-lived PKCE verifier store (in-memory). Survives single-process API; not multi-instance.
 * Location: apps/api/src/lib/integrations/oauth/pkceStore.ts
 */
type Entry = { codeVerifier: string; exp: number }

const store = new Map<string, Entry>()
const TTL_MS = 15 * 60 * 1000

export function putPkceVerifier(state: string, codeVerifier: string): void {
  store.set(state, { codeVerifier, exp: Date.now() + TTL_MS })
  if (store.size > 500) prune()
}

export function takePkceVerifier(state: string): string | null {
  const e = store.get(state)
  store.delete(state)
  if (!e) return null
  if (Date.now() > e.exp) return null
  return e.codeVerifier
}

function prune(): void {
  const now = Date.now()
  for (const [k, v] of store) {
    if (now > v.exp) store.delete(k)
  }
}
