/**
 * Load sealed OAuth access tokens for organic social connections.
 * Refresh is provider-specific and lands with channel workers later.
 * Location: apps/api/src/lib/integrations/social/tokens.ts
 */
import { and, eq } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { connectionCredentials, connections } from '../../../db/schema.js'
import { openSecret } from '../../crypto.js'

const SOCIAL_PROVIDERS = new Set(['linkedin', 'tiktok', 'x', 'pinterest'])

export async function getSocialAccessToken(
  businessId: string,
  connectionId: string,
): Promise<{ accessToken: string; provider: string; externalAccountId: string }> {
  const connRows = await db
    .select()
    .from(connections)
    .where(and(eq(connections.id, connectionId), eq(connections.businessId, businessId)))
    .limit(1)
  const conn = connRows[0]
  if (!conn) throw Object.assign(new Error('connection_not_found'), { statusCode: 404 })
  if (!SOCIAL_PROVIDERS.has(conn.provider)) {
    throw Object.assign(new Error('not_social_connection'), { statusCode: 400 })
  }
  if (conn.status !== 'active') {
    throw Object.assign(new Error('connection_inactive'), { statusCode: 409 })
  }

  const rows = await db
    .select()
    .from(connectionCredentials)
    .where(
      and(
        eq(connectionCredentials.connectionId, connectionId),
        eq(connectionCredentials.kind, 'access'),
      ),
    )
    .limit(1)
  const access = rows[0]
  if (!access) throw Object.assign(new Error('credential_missing'), { statusCode: 409 })

  return {
    accessToken: openSecret(access.ciphertext, access.iv, access.tag),
    provider: conn.provider,
    externalAccountId: conn.externalAccountId,
  }
}
