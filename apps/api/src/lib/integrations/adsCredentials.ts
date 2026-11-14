/**
 * Resolve ads mutate credentials — Integration Core OAuth only (no settings_secrets dual path).
 * Location: apps/api/src/lib/integrations/adsCredentials.ts
 */
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { connectionCredentials, connections } from '../../db/schema.js'
import { openSecret } from '../crypto.js'
import type { AdsProvider } from './ads.js'
import { getGoogleAccessToken } from './google/tokens.js'

export type AdsCredential = {
  plaintext: string
  source: 'connection'
  connectionId: string
}

async function accessTokenFromConnection(
  businessId: string,
  provider: string,
): Promise<AdsCredential | null> {
  const rows = await db
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.businessId, businessId),
        eq(connections.provider, provider),
        eq(connections.status, 'active'),
      ),
    )
    .orderBy(desc(connections.updatedAt))
    .limit(1)
  const conn = rows[0]
  if (!conn) return null

  if (provider === 'google_ads') {
    try {
      const { accessToken } = await getGoogleAccessToken(businessId, conn.id)
      return { plaintext: accessToken, source: 'connection', connectionId: conn.id }
    } catch {
      return null
    }
  }

  const creds = await db
    .select()
    .from(connectionCredentials)
    .where(
      and(
        eq(connectionCredentials.connectionId, conn.id),
        eq(connectionCredentials.kind, 'access'),
      ),
    )
    .limit(1)
  const access = creds[0]
  if (!access) return null
  return {
    plaintext: openSecret(access.ciphertext, access.iv, access.tag),
    source: 'connection',
    connectionId: conn.id,
  }
}

/** Active Integration Core OAuth connection only — fail closed without dual secret path. */
export async function resolveAdsCredential(
  businessId: string,
  provider: AdsProvider,
): Promise<AdsCredential | null> {
  return accessTokenFromConnection(businessId, provider)
}
