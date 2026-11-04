/**
 * Unipile client — config fail-closed (no default secrets).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { getUnipileConfig, requireUnipileConfig } from './client.js'

const PREV_DSN = process.env.UNIPILE_DSN
const PREV_TOKEN = process.env.UNIPILE_ACCESS_TOKEN

afterEach(() => {
  if (PREV_DSN === undefined) delete process.env.UNIPILE_DSN
  else process.env.UNIPILE_DSN = PREV_DSN
  if (PREV_TOKEN === undefined) delete process.env.UNIPILE_ACCESS_TOKEN
  else process.env.UNIPILE_ACCESS_TOKEN = PREV_TOKEN
})

describe('unipile config', () => {
  it('returns null when env missing', () => {
    delete process.env.UNIPILE_DSN
    delete process.env.UNIPILE_ACCESS_TOKEN
    expect(getUnipileConfig()).toBeNull()
  })

  it('require throws 503 when missing', () => {
    delete process.env.UNIPILE_DSN
    delete process.env.UNIPILE_ACCESS_TOKEN
    try {
      requireUnipileConfig()
      expect.fail('should throw')
    } catch (e) {
      const err = e as Error & { statusCode?: number }
      expect(err.message).toBe('unipile_not_configured')
      expect(err.statusCode).toBe(503)
    }
  })

  it('normalizes host DSN to https baseUrl', () => {
    process.env.UNIPILE_DSN = 'api1.unipile.com:12345'
    process.env.UNIPILE_ACCESS_TOKEN = 'tok_test'
    const cfg = getUnipileConfig()
    expect(cfg?.baseUrl).toBe('https://api1.unipile.com:12345')
    expect(cfg?.apiKey).toBe('tok_test')
  })
})
