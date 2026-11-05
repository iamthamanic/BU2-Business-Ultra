/**
 * Resolve ads mutate credentials — Integration Core OAuth first for Google Ads,
 * then legacy settings_secrets for key-gated providers.
 * Location: apps/api/src/lib/integrations/adsCredentials.ts
 */
import { and, desc, eq } from 'drizzle-orm'
import type { SecretProvider } from '@bu2/shared'
import { db } from '../../db/client.js'
import { connections } from '../../db/schema.js'
import { getBusinessSecret } from '../secrets.js'
import type { AdsProvider } from './ads.js'
import { getGoogleAccessToken } from './google/tokens.js'

export const ADS_PROVIDER_SECRET_GATE: Record<AdsProvider, SecretProvider> = {
  google_ads: 'google_ads',
  meta_ads: 'meta_ads',
  tiktok_ads: 'tiktok_ads',
  chatgpt_ads: 'chatgpt_ads',
}

export type AdsCredential = {
  plaintext: string
  source: 'connection' | 'secret'
  connectionId?: string
}

/** Prefer active google_ads Integration Core connection; fall back to settings_secrets. */
export async function resolveAdsCredential(
  businessId: string,
  provider: AdsProvider,
): Promise<AdsCredential | null> {
  if (provider === 'google_ads') {
    const rows = await db
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.businessId, businessId),
          eq(connections.provider, 'google_ads'),
          eq(connections.status, 'active'),
        ),
      )
      .orderBy(desc(connections.updatedAt))
      .limit(1)
    const conn = rows[0]
    if (conn) {
      try {
        const { accessToken } = await getGoogleAccessToken(businessId, conn.id)
        return { plaintext: accessToken, source: 'connection', connectionId: conn.id }
      } catch {
        // Fall through to legacy secret if token refresh fails.
      }
    }
  }

  const gate = ADS_PROVIDER_SECRET_GATE[provider]
  const secret = await getBusinessSecret(businessId, gate)
  if (!secret?.valid) return null
  return { plaintext: secret.plaintext, source: 'secret' }
}
