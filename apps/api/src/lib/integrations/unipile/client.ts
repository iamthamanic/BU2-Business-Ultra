/**
 * Thin Unipile HTTP client (DSN + X-API-KEY). Fail-closed if env missing.
 * Location: apps/api/src/lib/integrations/unipile/client.ts
 */
import { parseFetchJsonAs } from '../../parseFetchJson.js'

export type UnipileConfig = {
  baseUrl: string
  apiKey: string
}

export function getUnipileConfig(): UnipileConfig | null {
  const dsn = (process.env.UNIPILE_DSN || '').trim()
  const apiKey = (process.env.UNIPILE_ACCESS_TOKEN || '').trim()
  if (!dsn || !apiKey) return null
  const baseUrl = dsn.startsWith('http') ? dsn.replace(/\/$/, '') : `https://${dsn.replace(/\/$/, '')}`
  return { baseUrl, apiKey }
}

export function requireUnipileConfig(): UnipileConfig {
  const cfg = getUnipileConfig()
  if (!cfg) {
    throw Object.assign(new Error('unipile_not_configured'), { statusCode: 503 })
  }
  return cfg
}

async function unipileFetch<T>(
  cfg: UnipileConfig,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; data: T }> {
  const url = `${cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
  const isForm = typeof FormData !== 'undefined' && init?.body instanceof FormData
  const headers: Record<string, string> = {
    accept: 'application/json',
    'X-API-KEY': cfg.apiKey,
    ...(init?.headers as Record<string, string> | undefined),
  }
  if (init?.body && !isForm && !headers['content-type'] && !headers['Content-Type']) {
    headers['content-type'] = 'application/json'
  }
  const res = await fetch(url, {
    ...init,
    headers,
  })
  try {
    const data = await parseFetchJsonAs<T>(res, { throwOnBad: true, emptyAs: {} as T })
    return { status: res.status, data }
  } catch (e) {
    const err = e as Error & { statusCode?: number }
    throw Object.assign(new Error(`unipile_bad_json:${res.status}`), {
      statusCode: err.statusCode || 502,
    })
  }
}

export type UnipileConnectStart = {
  accountId: string
  qrCodeString: string | null
  raw: Record<string, unknown>
}

/** POST /api/v1/accounts { provider: TELEGRAM } → QR / account_id */
export async function unipileStartTelegram(cfg: UnipileConfig): Promise<UnipileConnectStart> {
  const { status, data } = await unipileFetch<Record<string, unknown>>(cfg, '/api/v1/accounts', {
    method: 'POST',
    body: JSON.stringify({ provider: 'TELEGRAM' }),
  })
  if (status >= 400 && status !== 202) {
    const err = (data as { type?: string; title?: string; detail?: string }).title ||
      (data as { message?: string }).message ||
      `unipile_connect_failed:${status}`
    throw Object.assign(new Error(String(err)), { statusCode: status >= 400 ? status : 502 })
  }
  const accountId = String(
    data.account_id || (data as { accountId?: string }).accountId || '',
  )
  if (!accountId) {
    throw Object.assign(new Error('unipile_missing_account_id'), { statusCode: 502 })
  }
  const checkpoint = data.checkpoint as Record<string, unknown> | undefined
  const qr =
    (typeof data.qrcode_string === 'string' && data.qrcode_string) ||
    (typeof data.qrCodeString === 'string' && data.qrCodeString) ||
    (typeof data.qrcode === 'string' && data.qrcode) ||
    (typeof checkpoint?.qrcode === 'string' && checkpoint.qrcode) ||
    (typeof checkpoint?.qrcode_string === 'string' && checkpoint.qrcode_string) ||
    null
  return { accountId, qrCodeString: qr, raw: data }
}

export type UnipileAccountStatus =
  | { state: 'pending' }
  | { state: 'connected'; account: Record<string, unknown> }
  | { state: 'failed'; reason: string }

/** GET /api/v1/accounts/:id — 404 pending, 200 connected */
export async function unipileGetAccount(
  cfg: UnipileConfig,
  accountId: string,
): Promise<UnipileAccountStatus> {
  const { status, data } = await unipileFetch<Record<string, unknown>>(
    cfg,
    `/api/v1/accounts/${encodeURIComponent(accountId)}`,
  )
  if (status === 404) return { state: 'pending' }
  if (status === 409) return { state: 'failed', reason: 'cancelled' }
  if (status === 410) return { state: 'failed', reason: 'expired' }
  if (status >= 400) {
    return {
      state: 'failed',
      reason: String((data as { title?: string }).title || `http_${status}`),
    }
  }
  const sources = data.sources as Array<{ status?: string }> | undefined
  const srcOk = !sources?.length || sources.some((s) => s.status === 'OK' || s.status === 'RUNNING')
  const name = String(data.name || data.display_name || accountId)
  return {
    state: 'connected',
    account: { ...data, _displayName: name, _ok: srcOk },
  }
}

export type UnipileChat = {
  id: string
  name: string | null
  provider_id?: string | null
  timestamp?: string | null
  unread_count?: number
}

export async function unipileListChats(
  cfg: UnipileConfig,
  accountId: string,
  limit = 40,
): Promise<UnipileChat[]> {
  const q = new URLSearchParams({
    account_id: accountId,
    limit: String(limit),
  })
  const { status, data } = await unipileFetch<{ items?: UnipileChat[] } | UnipileChat[]>(
    cfg,
    `/api/v1/chats?${q}`,
  )
  if (status >= 400) {
    throw Object.assign(new Error(`unipile_list_chats:${status}`), { statusCode: 502 })
  }
  if (Array.isArray(data)) return data
  return data.items || []
}

export type UnipileMessage = {
  id: string
  text?: string | null
  body?: string | null
  timestamp?: string | null
  date?: string | null
  is_sender?: boolean
  sender_id?: string | null
  chat_id?: string | null
}

export async function unipileListMessages(
  cfg: UnipileConfig,
  chatId: string,
  limit = 30,
): Promise<UnipileMessage[]> {
  const q = new URLSearchParams({ limit: String(limit) })
  const { status, data } = await unipileFetch<{ items?: UnipileMessage[] } | UnipileMessage[]>(
    cfg,
    `/api/v1/chats/${encodeURIComponent(chatId)}/messages?${q}`,
  )
  if (status >= 400) {
    throw Object.assign(new Error(`unipile_list_messages:${status}`), { statusCode: 502 })
  }
  if (Array.isArray(data)) return data
  return data.items || []
}

export async function unipileSendMessage(
  cfg: UnipileConfig,
  chatId: string,
  text: string,
): Promise<Record<string, unknown>> {
  const form = new FormData()
  form.append('text', text)
  const { status, data } = await unipileFetch<Record<string, unknown>>(
    cfg,
    `/api/v1/chats/${encodeURIComponent(chatId)}/messages`,
    {
      method: 'POST',
      body: form,
      headers: {
        accept: 'application/json',
        'X-API-KEY': cfg.apiKey,
        // let fetch set multipart boundary — omit content-type
      },
    },
  )
  if (status >= 400) {
    const err =
      (data as { title?: string; detail?: string }).title ||
      (data as { message?: string }).message ||
      `unipile_send_failed:${status}`
    throw Object.assign(new Error(String(err)), { statusCode: 502 })
  }
  return data
}
