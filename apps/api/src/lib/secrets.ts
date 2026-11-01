import { and, eq } from 'drizzle-orm'
import type { SecretProvider } from '@bu2/shared'
import { db } from '../db/client.js'
import { settingsSecrets } from '../db/schema.js'
import { keyHint, openSecret, sealSecret } from './crypto.js'

export async function upsertBusinessSecret(opts: {
  businessId: string
  provider: SecretProvider
  plaintext: string
  userId: string
  valid?: boolean
}) {
  const sealed = sealSecret(opts.plaintext)
  const existing = await db
    .select()
    .from(settingsSecrets)
    .where(
      and(
        eq(settingsSecrets.businessId, opts.businessId),
        eq(settingsSecrets.provider, opts.provider),
      ),
    )
    .limit(1)

  if (existing[0]) {
    await db
      .update(settingsSecrets)
      .set({
        ciphertext: sealed.ciphertext,
        iv: sealed.iv,
        tag: sealed.tag,
        keyHint: keyHint(opts.plaintext),
        valid: opts.valid ?? false,
        updatedByUserId: opts.userId,
        updatedAt: new Date(),
        lastCheckedAt: new Date(),
      })
      .where(eq(settingsSecrets.id, existing[0].id))
    return
  }

  await db.insert(settingsSecrets).values({
    businessId: opts.businessId,
    provider: opts.provider,
    ciphertext: sealed.ciphertext,
    iv: sealed.iv,
    tag: sealed.tag,
    keyHint: keyHint(opts.plaintext),
    valid: opts.valid ?? false,
    updatedByUserId: opts.userId,
    lastCheckedAt: new Date(),
  })
}

export async function getBusinessSecret(
  businessId: string,
  provider: SecretProvider,
): Promise<{ plaintext: string; valid: boolean; keyHint: string | null } | null> {
  const rows = await db
    .select()
    .from(settingsSecrets)
    .where(and(eq(settingsSecrets.businessId, businessId), eq(settingsSecrets.provider, provider)))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return {
    plaintext: openSecret(row.ciphertext, row.iv, row.tag),
    valid: row.valid,
    keyHint: row.keyHint,
  }
}

export async function listSecretStatuses(businessId: string) {
  const rows = await db
    .select({
      provider: settingsSecrets.provider,
      valid: settingsSecrets.valid,
      keyHint: settingsSecrets.keyHint,
      lastCheckedAt: settingsSecrets.lastCheckedAt,
      updatedAt: settingsSecrets.updatedAt,
    })
    .from(settingsSecrets)
    .where(eq(settingsSecrets.businessId, businessId))
  return rows
}

/** Lightweight validation stubs — real provider probes when keys present. */
export async function validateProviderKey(
  provider: SecretProvider,
  plaintext: string,
): Promise<{ valid: boolean; detail: string }> {
  if (!plaintext || plaintext.length < 8) {
    return { valid: false, detail: 'Key too short' }
  }
  if (provider === 'brevo') {
    try {
      const res = await fetch('https://api.brevo.com/v3/account', {
        headers: { 'api-key': plaintext, accept: 'application/json' },
      })
      return { valid: res.ok, detail: res.ok ? 'Brevo account OK' : `Brevo HTTP ${res.status}` }
    } catch (e) {
      return { valid: false, detail: String(e) }
    }
  }
  // Other providers: accept non-empty key as structurally present; live probe is key-gated stub
  return { valid: true, detail: `${provider} key accepted (live probe stub / key-gated)` }
}
