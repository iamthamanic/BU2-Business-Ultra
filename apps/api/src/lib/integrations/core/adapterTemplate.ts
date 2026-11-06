/**
 * Adapter template — copy when adding a credentials-only connector.
 * Location: apps/api/src/lib/integrations/core/adapterTemplate.ts
 *
 * Steps:
 * 1. Add provider id to IntegrationProvider (packages/shared) + PROVIDER_CATALOG
 *    with domainGroup: social | paid | finance | generic
 * 2. Copy this file → lib/integrations/<provider>/adapter.ts
 * 3. Implement connect + resolveCapabilities; register on boot
 * 4. Wire sync/send in a provider module only after credentials land
 *
 * Prefer official APIs (OAuth PKCE or API key). No secrets in code.
 */
import type { StructuredCapability } from '@bu2/shared'
import type { AdapterConnectInput, AdapterConnectResult, ProviderAdapter } from './adapter.js'
import { registerAdapter } from './adapter.js'

/** Replace 'mock' with the real IntegrationProvider id. */
const TEMPLATE_PROVIDER = 'mock' as const

function templateCapabilities(accountType: string): StructuredCapability[] {
  return [
    {
      operation: 'sync',
      allowed: true,
      scopes: [`${TEMPLATE_PROVIDER}.sync`],
      accountType,
      messageFormats: [],
      availability: 'available',
    },
  ]
}

/**
 * Skeleton adapter — not registered by default.
 * Call `registerTemplateAdapterForTests()` only in contract tests.
 */
export const templateAdapter: ProviderAdapter = {
  provider: TEMPLATE_PROVIDER,
  async connect(input: AdapterConnectInput): Promise<AdapterConnectResult> {
    const accountType = input.accountType || `${TEMPLATE_PROVIDER}_default`
    const caps = await this.resolveCapabilities({
      accountType,
      scopes: [`${TEMPLATE_PROVIDER}.sync`],
    })
    return {
      provider: TEMPLATE_PROVIDER,
      authMethod: 'api_key',
      externalAccountId: input.externalAccountId.trim(),
      displayName: (input.displayName || input.externalAccountId).trim(),
      accountType,
      credentials: [{ kind: 'access', plaintext: input.credential }],
      capabilities: caps,
      health: {
        ok: true,
        adapter: 'template',
        checkedAt: new Date().toISOString(),
      },
    }
  },
  async resolveCapabilities(ctx): Promise<StructuredCapability[]> {
    return templateCapabilities(ctx.accountType || `${TEMPLATE_PROVIDER}_default`)
  },
}

/** Test-only registration helper (idempotent). */
export function registerTemplateAdapterForTests(): void {
  registerAdapter(templateAdapter)
}
