/**
 * OAuth token exchange unit tests — mocked fetch; no real secrets.
 * Location: apps/api/src/lib/integrations/oauth/exchange.test.ts
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { exchangeGoogleCode, exchangeMetaCode, exchangeMicrosoftCode } from './exchange.js'

const cfg = { clientId: 'cid', clientSecret: 'csec', configured: true as const }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('exchangeGoogleCode', () => {
  it('exchanges code + PKCE and loads userinfo', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            access_token: 'ya29.test',
            refresh_token: '1//refresh',
            expires_in: 3600,
            scope: 'openid email https://www.googleapis.com/auth/gmail.modify',
            token_type: 'Bearer',
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            sub: '123',
            email: 'dev@example.com',
            name: 'Dev User',
          }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const tokens = await exchangeGoogleCode({
      code: 'auth-code',
      codeVerifier: 'verifier',
      redirectUri: 'http://127.0.0.1:8742/api/oauth/google/callback',
      cfg,
    })

    expect(tokens.accessToken).toBe('ya29.test')
    expect(tokens.refreshToken).toBe('1//refresh')
    expect(tokens.externalAccountId).toBe('dev@example.com')
    expect(tokens.displayName).toBe('Dev User')
    expect(tokens.accountType).toBe('gmail')
    expect(tokens.expiresAt).toBeInstanceOf(Date)

    const tokenCall = fetchMock.mock.calls[0]
    expect(String(tokenCall?.[0])).toContain('oauth2.googleapis.com/token')
    const body = String(tokenCall?.[1]?.body)
    expect(body).toContain('code_verifier=verifier')
    expect(body).toContain('client_id=cid')
  })

  it('fails closed when token endpoint errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: 'invalid_grant' }),
      }),
    )
    await expect(
      exchangeGoogleCode({
        code: 'bad',
        codeVerifier: 'v',
        redirectUri: 'http://127.0.0.1:8742/api/oauth/google/callback',
        cfg,
      }),
    ).rejects.toThrow(/google_token_exchange_failed/)
  })
})

describe('exchangeMicrosoftCode', () => {
  it('exchanges code and loads Graph /me', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            access_token: 'ms-access',
            refresh_token: 'ms-refresh',
            expires_in: 3599,
            scope: 'Mail.ReadWrite Mail.Send',
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: 'aad-1',
            displayName: 'Ada',
            userPrincipalName: 'ada@contoso.com',
          }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const tokens = await exchangeMicrosoftCode({
      code: 'code',
      codeVerifier: 'v',
      redirectUri: 'http://127.0.0.1:8742/api/oauth/microsoft/callback',
      cfg,
      tenant: 'common',
    })
    expect(tokens.externalAccountId).toBe('ada@contoso.com')
    expect(tokens.accountType).toBe('outlook')
    expect(tokens.refreshToken).toBe('ms-refresh')
  })
})

describe('exchangeMetaCode', () => {
  it('exchanges short token, upgrades long-lived, loads /me', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ access_token: 'short', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ access_token: 'long', expires_in: 5_184_000 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: 'page-1', name: 'Brand Page' }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const tokens = await exchangeMetaCode({
      code: 'code',
      redirectUri: 'http://127.0.0.1:8742/api/oauth/meta/callback',
      provider: 'instagram',
      cfg,
    })
    expect(tokens.accessToken).toBe('long')
    expect(tokens.externalAccountId).toBe('page-1')
    expect(tokens.accountType).toBe('instagram')
    expect(tokens.refreshToken).toBeNull()
  })
})
