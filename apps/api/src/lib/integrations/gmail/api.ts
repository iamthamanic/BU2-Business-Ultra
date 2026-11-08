/**
 * Thin Gmail REST helpers (users.threads / messages).
 * Location: apps/api/src/lib/integrations/gmail/api.ts
 */

export type GmailHeader = { name: string; value: string }

export type GmailMessage = {
  id: string
  threadId: string
  labelIds?: string[]
  snippet?: string
  internalDate?: string
  payload?: {
    headers?: GmailHeader[]
    mimeType?: string
    body?: { data?: string }
    parts?: Array<{
      mimeType?: string
      body?: { data?: string }
      parts?: unknown[]
    }>
  }
}

function header(headers: GmailHeader[] | undefined, name: string): string {
  const h = (headers || []).find((x) => x.name.toLowerCase() === name.toLowerCase())
  return h?.value?.trim() || ''
}

export function gmailHeader(msg: GmailMessage, name: string): string {
  return header(msg.payload?.headers, name)
}

function decodeB64Url(data: string | undefined): string {
  if (!data) return ''
  const pad = data.length % 4 === 0 ? '' : '='.repeat(4 - (data.length % 4))
  const b64 = (data + pad).replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(b64, 'base64').toString('utf8')
}

export function extractPlainText(msg: GmailMessage): string {
  const payload = msg.payload
  if (!payload) return msg.snippet || ''
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeB64Url(payload.body.data)
  }
  const parts = payload.parts || []
  for (const p of parts) {
    if (p.mimeType === 'text/plain' && p.body?.data) return decodeB64Url(p.body.data)
  }
  for (const p of parts) {
    if (p.mimeType === 'text/html' && p.body?.data) {
      return decodeB64Url(p.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }
  }
  return msg.snippet || ''
}

async function gmailJson<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
  })
  const text = await res.text()
  let json: unknown = {}
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text }
  }
  if (!res.ok) {
    throw Object.assign(new Error(classifyGmailHttpError(res.status, json)), {
      statusCode: res.status === 403 || res.status === 401 ? res.status : 502,
      detail: json,
    })
  }
  return json as T
}

/** Map Google Gmail HTTP failures to actionable error codes for the UI. */
function classifyGmailHttpError(status: number, body: unknown): string {
  const blob = JSON.stringify(body || {}).toLowerCase()
  if (status === 403) {
    if (
      blob.includes('has not been used') ||
      blob.includes('is disabled') ||
      blob.includes('accessnotconfigured') ||
      blob.includes('service_disabled')
    ) {
      return 'gmail_api_disabled'
    }
    if (
      blob.includes('insufficientpermissions') ||
      blob.includes('insufficient authentication scopes') ||
      blob.includes('access_denied')
    ) {
      return 'gmail_insufficient_scopes'
    }
    return 'gmail_api_403'
  }
  if (status === 401) return 'gmail_token_expired'
  return `gmail_api_${status}`
}

export async function listInboxThreads(
  accessToken: string,
  opts?: { pageToken?: string; maxResults?: number },
): Promise<{ threads: Array<{ id: string; snippet?: string; historyId?: string }>; nextPageToken?: string }> {
  const q = new URLSearchParams({
    maxResults: String(opts?.maxResults ?? 25),
    q: 'in:inbox',
  })
  if (opts?.pageToken) q.set('pageToken', opts.pageToken)
  return gmailJson(accessToken, `/threads?${q}`)
}

export async function getThread(
  accessToken: string,
  threadId: string,
): Promise<{ id: string; messages?: GmailMessage[] }> {
  return gmailJson(accessToken, `/threads/${encodeURIComponent(threadId)}?format=full`)
}

export async function sendGmailRaw(
  accessToken: string,
  rawRfc822: string,
  threadId?: string,
): Promise<{ id: string; threadId: string }> {
  const raw = Buffer.from(rawRfc822)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  const body: Record<string, string> = { raw }
  if (threadId) body.threadId = threadId
  return gmailJson(accessToken, '/messages/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function buildReplyRfc822(opts: {
  to: string
  from: string
  subject: string
  body: string
  inReplyTo?: string
  references?: string
}): string {
  const subject = opts.subject.toLowerCase().startsWith('re:')
    ? opts.subject
    : `Re: ${opts.subject}`
  const lines = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
  ]
  if (opts.inReplyTo) lines.push(`In-Reply-To: ${opts.inReplyTo}`)
  if (opts.references) lines.push(`References: ${opts.references}`)
  lines.push('', opts.body)
  return lines.join('\r\n')
}

/** Parse "Name <email@x.com>" or bare email. */
export function parseEmailAddress(raw: string): string {
  const m = raw.match(/<([^>]+)>/)
  if (m?.[1]) return m[1].trim()
  return raw.trim()
}
