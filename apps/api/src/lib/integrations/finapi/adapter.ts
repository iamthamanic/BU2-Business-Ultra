/**
 * finAPI adapter — stores client credentials; transaction sync lands later.
 * Location: apps/api/src/lib/integrations/finapi/adapter.ts
 */
import type { StructuredCapability } from '@bu2/shared'
import type { AdapterConnectInput, AdapterConnectResult, ProviderAdapter } from '../core/adapter.js'
import { registerAdapter } from '../core/adapter.js'

export type FinapiConnectFields = {
  clientId: string
  clientSecret: string
  dataDecryptionKey?: string
  displayName?: string
}

function finapiCapabilities(accountType: string): StructuredCapability[] {
  return [
    {
      operation: 'sync',
      allowed: true,
      scopes: ['finapi.accounts', 'finapi.transactions'],
      accountType,
      messageFormats: [],
      availability: 'degraded',
      reason: 'sync_worker_pending',
    },
  ]
}

export function encodeFinapiCredential(fields: FinapiConnectFields): string {
  return JSON.stringify({
    clientId: fields.clientId,
    clientSecret: fields.clientSecret,
    dataDecryptionKey: fields.dataDecryptionKey || undefined,
  })
}

export const finapiAdapter: ProviderAdapter = {
  provider: 'finapi',
  async connect(input: AdapterConnectInput): Promise<AdapterConnectResult> {
    let fields: FinapiConnectFields
    try {
      fields = JSON.parse(input.credential) as FinapiConnectFields
    } catch {
      throw Object.assign(new Error('finapi_invalid_credential'), { statusCode: 400 })
    }
    const clientId = String(fields.clientId || '').trim()
    const clientSecret = String(fields.clientSecret || '')
    const dataDecryptionKey = fields.dataDecryptionKey
      ? String(fields.dataDecryptionKey).trim()
      : undefined
    if (!clientId || !clientSecret) {
      throw Object.assign(new Error('finapi_missing_fields'), { statusCode: 400 })
    }
    if (clientId.length > 200 || clientSecret.length > 500) {
      throw Object.assign(new Error('finapi_field_too_long'), { statusCode: 400 })
    }
    const accountType = 'finapi_client'
    const caps = await this.resolveCapabilities({
      accountType,
      scopes: ['finapi.accounts', 'finapi.transactions'],
    })
    return {
      provider: 'finapi',
      authMethod: 'api_key',
      externalAccountId: `finapi:${clientId}`.slice(0, 160),
      displayName: input.displayName?.trim() || fields.displayName?.trim() || `finAPI · ${clientId}`,
      accountType,
      credentials: [
        {
          kind: 'finapi_config',
          plaintext: encodeFinapiCredential({
            clientId,
            clientSecret,
            dataDecryptionKey,
          }),
        },
      ],
      capabilities: caps,
      health: {
        ok: true,
        adapter: 'finapi',
        checkedAt: new Date().toISOString(),
        note: 'credentials_stored_sync_pending',
      },
    }
  },
  async resolveCapabilities(ctx): Promise<StructuredCapability[]> {
    return finapiCapabilities(ctx.accountType || 'finapi_client')
  },
}

export function ensureFinapiAdapterRegistered(): void {
  registerAdapter(finapiAdapter)
}

ensureFinapiAdapterRegistered()
