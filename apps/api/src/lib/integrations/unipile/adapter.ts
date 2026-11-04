/**
 * Unipile aggregator adapter — Telegram user sessions (private DMs).
 * Location: apps/api/src/lib/integrations/unipile/adapter.ts
 */
import type { StructuredCapability } from '@bu2/shared'
import type { AdapterConnectInput, AdapterConnectResult, ProviderAdapter } from '../core/adapter.js'
import { registerAdapter } from '../core/adapter.js'
import { getUnipileConfig, unipileGetAccount } from './client.js'

function unipileTelegramCapabilities(accountType: string): StructuredCapability[] {
  return [
    {
      operation: 'read_dm',
      allowed: true,
      scopes: ['unipile.telegram'],
      accountType,
      messageFormats: ['text'],
      window: { kind: 'none', freeReplyHours: null },
      availability: 'available',
    },
    {
      operation: 'send_dm',
      allowed: true,
      scopes: ['unipile.telegram'],
      accountType,
      messageFormats: ['text'],
      window: { kind: 'none', freeReplyHours: null },
      availability: 'available',
    },
    {
      operation: 'sync',
      allowed: true,
      scopes: ['unipile.telegram'],
      accountType,
      messageFormats: [],
      availability: 'available',
    },
  ]
}

export const unipileAdapter: ProviderAdapter = {
  provider: 'unipile',
  async connect(input: AdapterConnectInput): Promise<AdapterConnectResult> {
    const cfg = getUnipileConfig()
    if (!cfg) {
      throw Object.assign(new Error('unipile_not_configured'), { statusCode: 503 })
    }
    const accountId = input.externalAccountId.trim()
    if (!accountId) {
      throw Object.assign(new Error('unipile_account_id_required'), { statusCode: 400 })
    }
    const status = await unipileGetAccount(cfg, accountId)
    if (status.state !== 'connected') {
      throw Object.assign(new Error(`unipile_account_${status.state === 'pending' ? 'pending' : status.reason}`), {
        statusCode: 409,
      })
    }
    const accountType = input.accountType || 'telegram_user'
    const caps = await this.resolveCapabilities({ accountType, scopes: ['unipile.telegram'] })
    const display =
      input.displayName?.trim() ||
      String(status.account._displayName || status.account.name || `Telegram ${accountId}`)
    return {
      provider: 'unipile',
      authMethod: 'aggregator_session',
      externalAccountId: accountId,
      displayName: display,
      accountType,
      /** Platform token stays in env; store account id marker for audit. */
      credentials: [{ kind: 'unipile_account', plaintext: accountId }],
      capabilities: caps,
      health: {
        ok: Boolean(status.account._ok !== false),
        adapter: 'unipile',
        accountId,
        checkedAt: new Date().toISOString(),
      },
    }
  },
  async resolveCapabilities(ctx): Promise<StructuredCapability[]> {
    return unipileTelegramCapabilities(ctx.accountType || 'telegram_user')
  },
}

export function ensureUnipileAdapterRegistered(): void {
  registerAdapter(unipileAdapter)
}

ensureUnipileAdapterRegistered()
