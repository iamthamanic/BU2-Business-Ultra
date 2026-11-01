const API_BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown) {
    super(typeof body === 'object' && body && 'error' in body ? String((body as { error: string }).error) : `HTTP ${status}`)
    this.status = status
    this.body = body
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  // Fastify rejects empty bodies when Content-Type is application/json —
  // only set that header when a body is actually sent.
  const headers = new Headers(init?.headers)
  if (init?.body != null && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) throw new ApiError(res.status, body)
  return body as T
}
