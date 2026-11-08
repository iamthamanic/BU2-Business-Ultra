/**
 * adsKey adapter — API-key credentials for paid providers (TikTok, Reddit, …).
 * Prefer OAuth when available; this path is the simplest key gate.
 * Location: apps/api/src/lib/integrations/adsKey/adapter.ts
 */
import type { IntegrationProvider, StructuredCapability } from '@bu2/shared'
import type { AdapterConnectInput, AdapterConnectResult, ProviderAdapter } from '../core/adapter.js'
import { registerAdapter } from '../core/adapter.js'

const ADS_KEY_PROVIDERS = [
  'tiktok_ads',
  'chatgpt_ads',
  'reddit_ads',
  'pinterest_ads',
  'microsoft_ads',
] as const

type AdsKeyProvider = (typeof ADS_KEY_PROVIDERS)[number]

function caps(provider: AdsKeyProvider, accountType: string): StructuredCapability[] {
  return [
    {
      operation: 'sync',
      allowed: true,
      scopes: [`${provider}.sync`],
      accountType,
      messageFormats: [],
      availability: 'degraded',
      reason: 'sync_worker_pending',
    },
  ]
}

function makeAdapter(provider: AdsKeyProvider): ProviderAdapter {
  return {
    provider,
    async connect(input: AdapterConnectInput): Promise<AdapterConnectResult> {
      const key = input.credential.trim()
      if (!key || key.length < 8) {
        throw Object.assign(new Error('ads_api_key_invalid'), { statusCode: 400 })
      }
      if (key.length > 2000) {
        throw Object.assign(new Error('ads_api_key_too_long'), { statusCode: 400 })
      }
      const accountType = `${provider}_key`
      const hint = key.length > 8 ? `…${key.slice(-4)}` : provider
      return {
        provider,
        authMethod: 'api_key',
        externalAccountId: `${provider}:${hint}`.slice(0, 160),
        displayName: input.displayName?.trim() || `${provider} · ${hint}`,
        accountType,
        credentials: [{ kind: 'access', plaintext: key }],
        capabilities: caps(provider, accountType),
        health: {
          ok: true,
          adapter: 'ads_key',
          checkedAt: new Date().toISOString(),
          note: 'credentials_stored_sync_pending',
        },
      }
    },
    async resolveCapabilities(ctx): Promise<StructuredCapability[]> {
      return caps(provider, ctx.accountType || `${provider}_key`)
    },
  }
}

let registered = false

export function ensureAdsKeyAdaptersRegistered(): void {
  if (registered) return
  for (const id of ADS_KEY_PROVIDERS) {
    registerAdapter(makeAdapter(id))
  }
  registered = true
}

ensureAdsKeyAdaptersRegistered()

export function isAdsKeyProvider(id: string): id is AdsKeyProvider {
  return (ADS_KEY_PROVIDERS as readonly string[]).includes(id)
}

export type { AdsKeyProvider }
export type AdsKeyIntegrationProvider = Extract<IntegrationProvider, AdsKeyProvider>
