/**
 * Telegram adapter contract — getMe connect + capabilities (mocked fetch).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StructuredCapabilitySchema } from '@bu2/shared'
import { ensureTelegramAdapterRegistered, telegramAdapter } from './adapter.js'
import { purposeAllowed } from '../core/capabilities.js'

ensureTelegramAdapterRegistered()

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('telegram adapter', () => {
  it('connects via getMe and returns bot_token credential', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          ok: true,
          result: { id: 42, is_bot: true, first_name: 'BU', username: 'bu2_bot' },
        }),
      })),
    )

    const result = await telegramAdapter.connect({
      externalAccountId: 'x',
      credential: '123456:ABCDEF-fake-token-value',
    })

    expect(result.provider).toBe('telegram')
    expect(result.authMethod).toBe('bot_token')
    expect(result.externalAccountId).toBe('42')
    expect(result.displayName).toBe('@bu2_bot')
    expect(result.credentials[0]?.kind).toBe('bot_token')
    for (const cap of result.capabilities) {
      expect(StructuredCapabilitySchema.safeParse(cap).success).toBe(true)
    }
    expect(purposeAllowed(result.capabilities, 'send_dm').allowed).toBe(true)
    expect(purposeAllowed(result.capabilities, 'sync').allowed).toBe(true)
  })

  it('fails closed on invalid token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: false, description: 'Unauthorized' }),
      })),
    )

    await expect(
      telegramAdapter.connect({
        externalAccountId: 'x',
        credential: 'bad-token-that-is-long-enough',
      }),
    ).rejects.toThrow(/Unauthorized|telegram/i)
  })
})
