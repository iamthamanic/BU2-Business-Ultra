/**
 * OAuth complete mapping tests — no DB / no secrets.
 * Location: apps/api/src/lib/integrations/oauth/complete.test.ts
 */
import { describe, expect, it } from 'vitest'
import { tokensToConnectResult } from './complete.js'
import type { ExchangedTokens } from './exchange.js'

const baseTokens: ExchangedTokens = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: new Date('2030-01-01T00:00:00.000Z'),
  scopes: ['openid', 'email'],
  externalAccountId: 'user@example.com',
  displayName: 'User',
  accountType: 'gmail',
  raw: {},
}

describe('tokensToConnectResult', () => {
  it('maps Google tokens to gmail mail capabilities + access/refresh', () => {
    const r = tokensToConnectResult('google', baseTokens)
    expect(r.provider).toBe('google')
    expect(r.authMethod).toBe('oauth_pkce')
    expect(r.credentials.map((c) => c.kind).sort()).toEqual(['access', 'refresh'])
    expect(r.capabilities.some((c) => c.operation === 'read_mail' && c.allowed)).toBe(true)
    expect(r.capabilities.some((c) => c.operation === 'send_mail' && c.allowed)).toBe(true)
  })

  it('maps Meta Instagram to DM capabilities without refresh', () => {
    const r = tokensToConnectResult('instagram', {
      ...baseTokens,
      refreshToken: null,
      accountType: 'instagram',
      externalAccountId: 'ig-1',
    })
    expect(r.provider).toBe('instagram')
    expect(r.credentials).toHaveLength(1)
    expect(r.capabilities.some((c) => c.operation === 'read_dm' && c.allowed)).toBe(true)
    expect(r.capabilities.some((c) => c.operation === 'read_mail')).toBe(false)
  })
})
