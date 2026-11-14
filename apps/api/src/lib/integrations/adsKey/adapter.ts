/**
 * adsKey adapter — retired. chatgpt_ads / reddit_ads / microsoft_ads use OAuth PKCE.
 * Kept so older imports resolve; no adapters registered.
 * Location: apps/api/src/lib/integrations/adsKey/adapter.ts
 */

export function ensureAdsKeyAdaptersRegistered(): void {
  // no-op — paid ads providers connect via OAuth
}

export function isAdsKeyProvider(_id: string): boolean {
  return false
}
