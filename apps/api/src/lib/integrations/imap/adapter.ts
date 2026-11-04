/**
 * IMAP/POP adapter — stores mailbox credentials; sync worker lands later.
 * Location: apps/api/src/lib/integrations/imap/adapter.ts
 */
import type { StructuredCapability } from '@bu2/shared'
import type { AdapterConnectInput, AdapterConnectResult, ProviderAdapter } from '../core/adapter.js'
import { registerAdapter } from '../core/adapter.js'

export type ImapConnectFields = {
  host: string
  port: number
  user: string
  password: string
  secure: boolean
  protocol: 'imap' | 'pop3'
  displayName?: string
}

function imapCapabilities(accountType: string): StructuredCapability[] {
  return [
    {
      operation: 'read_mail',
      allowed: true,
      scopes: ['imap'],
      accountType,
      messageFormats: ['text', 'html'],
      window: { kind: 'none', freeReplyHours: null },
      availability: 'available',
    },
    {
      operation: 'send_mail',
      allowed: false,
      reason: 'smtp_outbound_not_wired',
      scopes: ['imap'],
      accountType,
      messageFormats: ['text', 'html'],
      availability: 'unavailable',
    },
    {
      operation: 'sync',
      allowed: true,
      scopes: ['imap'],
      accountType,
      messageFormats: [],
      availability: 'degraded',
      reason: 'sync_worker_pending',
    },
  ]
}

/** Credential blob stored encrypted as kind `imap_config`. */
export function encodeImapCredential(fields: ImapConnectFields): string {
  return JSON.stringify({
    host: fields.host,
    port: fields.port,
    user: fields.user,
    password: fields.password,
    secure: fields.secure,
    protocol: fields.protocol,
  })
}

export const imapAdapter: ProviderAdapter = {
  provider: 'imap',
  async connect(input: AdapterConnectInput): Promise<AdapterConnectResult> {
    let fields: ImapConnectFields
    try {
      fields = JSON.parse(input.credential) as ImapConnectFields
    } catch {
      throw Object.assign(new Error('imap_invalid_credential'), { statusCode: 400 })
    }
    const host = String(fields.host || '').trim()
    const user = String(fields.user || '').trim()
    const password = String(fields.password || '')
    const port = Number(fields.port) || (fields.secure === false ? 143 : 993)
    const protocol = fields.protocol === 'pop3' ? 'pop3' : 'imap'
    if (!host || !user || !password) {
      throw Object.assign(new Error('imap_missing_fields'), { statusCode: 400 })
    }
    if (host.length > 200 || user.length > 200 || password.length > 500) {
      throw Object.assign(new Error('imap_field_too_long'), { statusCode: 400 })
    }
    const accountType = protocol === 'pop3' ? 'pop3_mailbox' : 'imap_mailbox'
    const caps = await this.resolveCapabilities({ accountType, scopes: ['imap'] })
    const externalAccountId = `${protocol}:${user}@${host}:${port}`.slice(0, 160)
    return {
      provider: 'imap',
      authMethod: 'password',
      externalAccountId,
      displayName: input.displayName?.trim() || `${user} @ ${host}`,
      accountType,
      credentials: [
        {
          kind: 'imap_config',
          plaintext: encodeImapCredential({
            host,
            port,
            user,
            password,
            secure: fields.secure !== false,
            protocol,
          }),
        },
      ],
      capabilities: caps,
      health: {
        ok: true,
        adapter: 'imap',
        protocol,
        host,
        port,
        checkedAt: new Date().toISOString(),
        note: 'credentials_stored_sync_pending',
      },
    }
  },
  async resolveCapabilities(ctx): Promise<StructuredCapability[]> {
    return imapCapabilities(ctx.accountType || 'imap_mailbox')
  },
}

export function ensureImapAdapterRegistered(): void {
  registerAdapter(imapAdapter)
}

ensureImapAdapterRegistered()
