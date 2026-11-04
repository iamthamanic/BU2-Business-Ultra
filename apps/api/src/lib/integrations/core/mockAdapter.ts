/**
 * Mock provider adapter — contract tests and local Integration Core smoke.
 * Location: apps/api/src/lib/integrations/core/mockAdapter.ts
 */
import type { StructuredCapability } from '@bu2/shared'
import type { AdapterConnectInput, AdapterConnectResult, ProviderAdapter } from './adapter.js'
import { registerAdapter } from './adapter.js'

function mockCapabilities(accountType: string): StructuredCapability[] {
  return [
    {
      operation: 'read_dm',
      allowed: true,
      scopes: ['mock.read'],
      accountType,
      messageFormats: ['text'],
      window: { kind: 'none', freeReplyHours: null },
      availability: 'available',
    },
    {
      operation: 'send_dm',
      allowed: true,
      scopes: ['mock.send'],
      accountType,
      messageFormats: ['text'],
      window: { kind: 'customer_care_hours', freeReplyHours: 24, notes: 'Mock 24h window' },
      availability: 'available',
    },
    {
      operation: 'sync',
      allowed: true,
      scopes: ['mock.sync'],
      accountType,
      messageFormats: [],
      availability: 'available',
    },
    {
      operation: 'publish',
      allowed: false,
      reason: 'mock_no_publish',
      scopes: [],
      accountType,
      messageFormats: [],
      availability: 'unavailable',
    },
  ]
}

export const mockAdapter: ProviderAdapter = {
  provider: 'mock',
  async connect(input: AdapterConnectInput): Promise<AdapterConnectResult> {
    const accountType = input.accountType || 'mock_inbox'
    const caps = await this.resolveCapabilities({
      accountType,
      scopes: ['mock.read', 'mock.send', 'mock.sync'],
    })
    return {
      provider: 'mock',
      authMethod: 'mock',
      externalAccountId: input.externalAccountId.trim(),
      displayName: (input.displayName || input.externalAccountId).trim(),
      accountType,
      credentials: [{ kind: 'access', plaintext: input.credential }],
      capabilities: caps,
      health: { ok: true, adapter: 'mock', checkedAt: new Date().toISOString() },
    }
  },
  async resolveCapabilities(ctx): Promise<StructuredCapability[]> {
    return mockCapabilities(ctx.accountType || 'mock_inbox')
  },
}

/** Idempotent registration for app boot + tests. */
export function ensureMockAdapterRegistered(): void {
  registerAdapter(mockAdapter)
}

ensureMockAdapterRegistered()
