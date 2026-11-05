/**
 * Google OAuth access-token load + refresh for Integration Core connections.
 * Location: apps/api/src/lib/integrations/google/tokens.ts
 */
import { and, eq } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { connectionCredentials, connections } from '../../../db/schema.js'
import { keyHint, openSecret, sealSecret } from '../../crypto.js'
import { getGoogleOAuthConfig } from '../oauth/config.js'

export async function getGoogleAccessToken(
  businessId: string,
  connectionId: string,
): Promise<{ accessToken: string; refreshToken: string | null }> {
  const connRows = await db
    .select()
    .from(connections)
    .where(and(eq(connections.id, connectionId), eq(connections.businessId, businessId)))
    .limit(1)
  const conn = connRows[0]
  if (!conn) throw Object.assign(new Error('connection_not_found'), { statusCode: 404 })
  if (conn.provider !== 'google' && conn.provider !== 'youtube' && conn.provider !== 'google_ads') {
    throw Object.assign(new Error('not_google_connection'), { statusCode: 400 })
  }
  if (conn.status !== 'active') {
    throw Object.assign(new Error('connection_inactive'), { statusCode: 409 })
  }

  const rows = await db
    .select()
    .from(connectionCredentials)
    .where(eq(connectionCredentials.connectionId, connectionId))

  const accessRow = rows.find((r) => r.kind === 'access')
  const refreshRow = rows.find((r) => r.kind === 'refresh')
  if (!accessRow) throw Object.assign(new Error('credential_missing'), { statusCode: 409 })

  let accessToken = openSecret(accessRow.ciphertext, accessRow.iv, accessRow.tag)
  const refreshToken = refreshRow
    ? openSecret(refreshRow.ciphertext, refreshRow.iv, refreshRow.tag)
    : null

  const expired =
    accessRow.expiresAt != null && accessRow.expiresAt.getTime() < Date.now() + 60_000

  if (expired && refreshToken) {
    const cfg = getGoogleOAuthConfig()
    if (!cfg.configured) throw Object.assign(new Error('google_oauth_not_configured'), { statusCode: 503 })
    const body = new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    })
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
    const json = (await res.json()) as {
      access_token?: string
      expires_in?: number
      error?: string
    }
    if (!res.ok || !json.access_token) {
      throw Object.assign(new Error(`google_refresh_failed:${json.error || res.status}`), {
        statusCode: 502,
      })
    }
    accessToken = json.access_token
    const sealed = sealSecret(accessToken)
    const expiresAt =
      typeof json.expires_in === 'number'
        ? new Date(Date.now() + json.expires_in * 1000)
        : null
    await db
      .update(connectionCredentials)
      .set({
        ciphertext: sealed.ciphertext,
        iv: sealed.iv,
        tag: sealed.tag,
        keyHint: keyHint(accessToken),
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(connectionCredentials.id, accessRow.id))
  }

  return { accessToken, refreshToken }
}
