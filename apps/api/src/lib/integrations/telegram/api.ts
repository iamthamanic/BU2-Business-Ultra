/**
 * Thin Telegram Bot HTTP client (official Bot API).
 * Location: apps/api/src/lib/integrations/telegram/api.ts
 * Docs: https://core.telegram.org/bots/api
 */

const API_BASE = 'https://api.telegram.org'

export type TelegramUser = {
  id: number
  is_bot?: boolean
  first_name?: string
  last_name?: string
  username?: string
}

export type TelegramChat = {
  id: number
  type: string
  title?: string
  username?: string
  first_name?: string
  last_name?: string
}

export type TelegramMessage = {
  message_id: number
  date: number
  chat: TelegramChat
  from?: TelegramUser
  text?: string
  caption?: string
}

export type TelegramUpdate = {
  update_id: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
}

type ApiOk<T> = { ok: true; result: T }
type ApiFail = { ok: false; description?: string; error_code?: number }

async function callApi<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const url = `${API_BASE}/bot${token}/${method}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = (await res.json()) as ApiOk<T> | ApiFail
  if (!json.ok) {
    const err = new Error(json.description || `telegram_${method}_failed`)
    ;(err as Error & { statusCode?: number }).statusCode = 502
    throw err
  }
  return json.result
}

export async function telegramGetMe(token: string): Promise<TelegramUser> {
  return callApi<TelegramUser>(token, 'getMe')
}

export async function telegramGetUpdates(
  token: string,
  opts: { offset?: number; limit?: number; timeout?: number },
): Promise<TelegramUpdate[]> {
  return callApi<TelegramUpdate[]>(token, 'getUpdates', {
    offset: opts.offset,
    limit: opts.limit ?? 50,
    timeout: opts.timeout ?? 0,
    allowed_updates: ['message', 'edited_message'],
  })
}

export async function telegramSendMessage(
  token: string,
  chatId: string | number,
  text: string,
): Promise<TelegramMessage> {
  return callApi<TelegramMessage>(token, 'sendMessage', {
    chat_id: chatId,
    text,
  })
}

export type TelegramMediaKind = 'photo' | 'document' | 'audio' | 'voice'

async function callApiMultipart<T>(
  token: string,
  method: string,
  form: FormData,
): Promise<T> {
  const url = `${API_BASE}/bot${token}/${method}`
  const res = await fetch(url, { method: 'POST', body: form })
  const json = (await res.json()) as ApiOk<T> | ApiFail
  if (!json.ok) {
    const err = new Error(json.description || `telegram_${method}_failed`)
    ;(err as Error & { statusCode?: number }).statusCode = 502
    throw err
  }
  return json.result
}

/** Send local file bytes as photo / document / audio / voice. */
export async function telegramSendMedia(
  token: string,
  chatId: string | number,
  opts: {
    kind: TelegramMediaKind
    bytes: Buffer
    filename: string
    mime: string
    caption?: string
  },
): Promise<TelegramMessage> {
  const form = new FormData()
  form.append('chat_id', String(chatId))
  if (opts.caption?.trim()) form.append('caption', opts.caption.trim().slice(0, 1024))
  const blob = new Blob([new Uint8Array(opts.bytes)], {
    type: opts.mime || 'application/octet-stream',
  })
  const field =
    opts.kind === 'photo'
      ? 'photo'
      : opts.kind === 'audio'
        ? 'audio'
        : opts.kind === 'voice'
          ? 'voice'
          : 'document'
  const method =
    opts.kind === 'photo'
      ? 'sendPhoto'
      : opts.kind === 'audio'
        ? 'sendAudio'
        : opts.kind === 'voice'
          ? 'sendVoice'
          : 'sendDocument'
  form.append(field, blob, opts.filename)
  return callApiMultipart<TelegramMessage>(token, method, form)
}

export function displayNameFromUser(u?: TelegramUser | null, chat?: TelegramChat | null): string {
  if (u) {
    const parts = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
    if (parts) return parts
    if (u.username) return `@${u.username}`
    return `Telegram ${u.id}`
  }
  if (chat?.title) return chat.title
  if (chat?.username) return `@${chat.username}`
  const parts = [chat?.first_name, chat?.last_name].filter(Boolean).join(' ').trim()
  if (parts) return parts
  return chat ? `Chat ${chat.id}` : 'Telegram'
}
