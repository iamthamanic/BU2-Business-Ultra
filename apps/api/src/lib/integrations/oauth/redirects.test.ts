/**
 * OAuth redirect bucket mapping.
 * Location: apps/api/src/lib/integrations/oauth/redirects.test.ts
 */
import { describe, expect, it } from 'vitest'
import { oauthRedirectKey } from './redirects.js'

describe('oauthRedirectKey', () => {
  it('maps Google family to google', () => {
    expect(oauthRedirectKey('google')).toBe('google')
    expect(oauthRedirectKey('youtube')).toBe('google')
    expect(oauthRedirectKey('google_ads')).toBe('google')
  })

  it('maps Meta family to meta', () => {
    expect(oauthRedirectKey('facebook')).toBe('meta')
    expect(oauthRedirectKey('instagram')).toBe('meta')
    expect(oauthRedirectKey('whatsapp')).toBe('meta')
    expect(oauthRedirectKey('meta_ads')).toBe('meta')
  })

  it('maps new social OAuth families', () => {
    expect(oauthRedirectKey('linkedin')).toBe('linkedin')
    expect(oauthRedirectKey('tiktok')).toBe('tiktok')
    expect(oauthRedirectKey('tiktok_ads')).toBe('tiktok')
    expect(oauthRedirectKey('x')).toBe('x')
    expect(oauthRedirectKey('pinterest')).toBe('pinterest')
    expect(oauthRedirectKey('pinterest_ads')).toBe('pinterest')
  })

  it('maps remaining paid ads to OAuth buckets', () => {
    expect(oauthRedirectKey('microsoft_ads')).toBe('microsoft')
    expect(oauthRedirectKey('reddit_ads')).toBe('reddit')
    expect(oauthRedirectKey('chatgpt_ads')).toBe('chatgpt')
  })

  it('returns null for non-oauth providers', () => {
    expect(oauthRedirectKey('telegram')).toBeNull()
    expect(oauthRedirectKey('imap')).toBeNull()
    expect(oauthRedirectKey('finapi')).toBeNull()
  })
})
