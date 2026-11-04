/**
 * Telegram Bot provider adapter — connect via bot token + structured capabilities.
 * Location: apps/api/src/lib/integrations/telegram/adapter.ts
 */
import type { StructuredCapability } from '@bu2/shared'
import type { AdapterConnectInput, AdapterConnectResult, ProviderAdapter } from '../core/adapter.js'
import { registerAdapter } from '../core/adapter.js'
import { telegramGetMe } from './api.js'

function telegramCapabilities(accountType: string): StructuredCapability[] {
  return [
    {
      operation: 'read_dm',
      allowed: true,
      scopes: ['telegram.bot'],
      accountType,
      messageFormats: ['text'],
      window: { kind: 'none', freeReplyHours: null },
      availability: 'available',
      reason: undefined,
    },
    {
      operation: 'send_dm',
      allowed: true,
      scopes: ['telegram.bot'],
      accountType,
      messageFormats: ['text'],
      window: { kind: 'none', freeReplyHours: null, notes: 'Bot can reply in chats where users messaged the bot' },
      availability: 'available',
    },
    {
      operation: 'sync',
      allowed: true,
      scopes: ['telegram.bot'],
      accountType,
      messageFormats: [],
      availability: 'available',
    },
  ]
}

export const telegramAdapter: ProviderAdapter = {
  provider: 'telegram',
  async connect(input: AdapterConnectInput): Promise<AdapterConnectResult> {
    const token = input.credential.trim()
    const me = await telegramGetMe(token)
    if (!me?.id) {
      throw Object.assign(new Error('telegram_getMe_invalid'), { statusCode: 400 })
    }
    const accountType = 'telegram_bot'
    const caps = await this.resolveCapabilities({ accountType, scopes: ['telegram.bot'] })
    const uname = me.username ? `@${me.username}` : `bot:${me.id}`
    return {
      provider: 'telegram',
      authMethod: 'bot_token',
      externalAccountId: String(me.id),
      displayName: input.displayName?.trim() || uname,
      accountType,
      credentials: [{ kind: 'bot_token', plaintext: token }],
      capabilities: caps,
      health: {
        ok: true,
        adapter: 'telegram',
        botId: me.id,
        username: me.username || null,
        checkedAt: new Date().toISOString(),
      },
    }
  },
  async resolveCapabilities(ctx): Promise<StructuredCapability[]> {
    return telegramCapabilities(ctx.accountType || 'telegram_bot')
  },
}

export function ensureTelegramAdapterRegistered(): void {
  registerAdapter(telegramAdapter)
}

ensureTelegramAdapterRegistered()
