/**
 * Provider adapter contract — connect / capabilities / send stubs.
 * Location: apps/api/src/lib/integrations/core/adapter.ts
 */
import type {
  ConnectionAuthMethod,
  IntegrationProvider,
  StructuredCapability,
} from '@bu2/shared'

export type AdapterConnectInput = {
  externalAccountId: string
  displayName?: string
  credential: string
  accountType?: string
}

export type AdapterConnectResult = {
  provider: IntegrationProvider
  authMethod: ConnectionAuthMethod
  externalAccountId: string
  displayName: string
  accountType: string
  /** Credential kinds to persist encrypted (plaintext only in-memory here). */
  credentials: Array<{ kind: string; plaintext: string }>
  capabilities: StructuredCapability[]
  health: Record<string, unknown>
}

export type ProviderAdapter = {
  provider: IntegrationProvider
  connect(input: AdapterConnectInput): Promise<AdapterConnectResult>
  resolveCapabilities(ctx: {
    accountType: string
    scopes: string[]
  }): Promise<StructuredCapability[]>
}

const adapters = new Map<IntegrationProvider, ProviderAdapter>()

export function registerAdapter(adapter: ProviderAdapter): void {
  adapters.set(adapter.provider, adapter)
}

export function getAdapter(provider: IntegrationProvider): ProviderAdapter | undefined {
  return adapters.get(provider)
}
