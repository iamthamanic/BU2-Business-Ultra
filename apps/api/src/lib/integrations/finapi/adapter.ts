/**
 * finAPI adapter — platform client from env; bank Web Form connect lands next.
 * Location: apps/api/src/lib/integrations/finapi/adapter.ts
 */
import type { StructuredCapability } from '@bu2/shared'
import type { AdapterConnectInput, AdapterConnectResult, ProviderAdapter } from '../core/adapter.js'
import { registerAdapter } from '../core/adapter.js'
import { getFinapiPlatformConfig, verifyFinapiPlatformCredentials } from './config.js'

function finapiCapabilities(accountType: string): StructuredCapability[] {
  return [
    {
      operation: 'sync',
      allowed: true,
      scopes: ['finapi.accounts', 'finapi.transactions'],
      accountType,
      messageFormats: [],
      availability: 'degraded',
      reason: 'bank_web_form_pending',
    },
  ]
}

export const finapiAdapter: ProviderAdapter = {
  provider: 'finapi',
  async connect(input: AdapterConnectInput): Promise<AdapterConnectResult> {
    const cfg = getFinapiPlatformConfig()
    if (!cfg.configured) {
      throw Object.assign(new Error('finapi_env_not_configured'), { statusCode: 503 })
    }
    const probe = await verifyFinapiPlatformCredentials()
    if (!probe.ok) {
      throw Object.assign(new Error(probe.detail), { statusCode: 502 })
    }
    const accountType = 'finapi_platform'
    const caps = await this.resolveCapabilities({
      accountType,
      scopes: ['finapi.accounts', 'finapi.transactions'],
    })
    /** Store a non-secret marker — real client secret stays in env only. */
    const marker = JSON.stringify({
      source: 'env',
      clientIdHint: cfg.clientId.slice(0, 4) + '…',
      baseUrl: cfg.baseUrl,
      verifiedAt: new Date().toISOString(),
    })
    return {
      provider: 'finapi',
      authMethod: 'api_key',
      externalAccountId: `finapi:platform:${cfg.clientId}`.slice(0, 160),
      displayName: input.displayName?.trim() || 'finAPI (App)',
      accountType,
      credentials: [{ kind: 'finapi_platform', plaintext: marker }],
      capabilities: caps,
      health: {
        ok: true,
        adapter: 'finapi',
        checkedAt: new Date().toISOString(),
        note: 'platform_env_verified_bank_web_form_pending',
      },
    }
  },
  async resolveCapabilities(ctx): Promise<StructuredCapability[]> {
    return finapiCapabilities(ctx.accountType || 'finapi_platform')
  },
}

export function ensureFinapiAdapterRegistered(): void {
  registerAdapter(finapiAdapter)
}

ensureFinapiAdapterRegistered()
