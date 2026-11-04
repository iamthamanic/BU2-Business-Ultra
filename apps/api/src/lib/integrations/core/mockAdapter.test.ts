/**
 * Mock adapter contract tests — connect + structured capabilities.
 */
import { describe, expect, it } from 'vitest'
import { SetModuleBindingSchema, StructuredCapabilitySchema } from '@bu2/shared'
import { getAdapter } from './adapter.js'
import { purposeAllowed } from './capabilities.js'
import { ensureMockAdapterRegistered, mockAdapter } from './mockAdapter.js'

ensureMockAdapterRegistered()

describe('mock adapter contract', () => {
  it('registers under provider mock', () => {
    expect(getAdapter('mock')).toBe(mockAdapter)
  })

  it('connect returns encrypted-ready credentials and structured capabilities', async () => {
    const result = await mockAdapter.connect({
      externalAccountId: 'mock-acct-1',
      displayName: 'Mock Inbox',
      credential: 'secret-token-value',
    })
    expect(result.provider).toBe('mock')
    expect(result.authMethod).toBe('mock')
    expect(result.externalAccountId).toBe('mock-acct-1')
    expect(result.credentials.length).toBe(1)
    expect(result.credentials[0]?.kind).toBe('access')
    expect(result.credentials[0]?.plaintext).toBe('secret-token-value')
    expect(result.capabilities.length).toBeGreaterThan(0)
    for (const cap of result.capabilities) {
      const parsed = StructuredCapabilitySchema.safeParse(cap)
      expect(parsed.success).toBe(true)
      expect(typeof cap.allowed).toBe('boolean')
      expect(Array.isArray(cap.scopes)).toBe(true)
      expect(Array.isArray(cap.messageFormats)).toBe(true)
      expect(['available', 'degraded', 'unavailable']).toContain(cap.availability)
    }
  })

  it('send_dm allowed with window; publish denied', async () => {
    const caps = await mockAdapter.resolveCapabilities({
      accountType: 'mock_inbox',
      scopes: [],
    })
    const send = purposeAllowed(caps, 'send_dm')
    expect(send.allowed).toBe(true)
    expect(send.capability?.window?.freeReplyHours).toBe(24)

    const publish = purposeAllowed(caps, 'publish')
    expect(publish.allowed).toBe(false)
    expect(publish.reason).toBeTruthy()
  })

  it('fail-closed when capability missing', () => {
    const r = purposeAllowed([], 'read_mail')
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('capability_missing')
  })

  it('SetModuleBindingSchema accepts inbox toggle payload', () => {
    const parsed = SetModuleBindingSchema.safeParse({
      connectionId: '00000000-0000-4000-8000-000000000001',
      module: 'inbox',
      enabled: true,
    })
    expect(parsed.success).toBe(true)
  })
})
