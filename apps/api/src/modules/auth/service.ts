/**
 * auth domain helpers.
 * Location: apps/api/src/modules/auth/service.ts
 */
import { eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { sessions, users } from '../../db/schema.js'
import { hashToken, randomToken } from '../../lib/crypto.js'
import { hashPassword } from '../../lib/password.js'
import { loadEnv } from '../../lib/env.js'
import { writeAudit } from '../../lib/audit.js'

export const SESSION_DAYS = 14

export async function ensureUser(email: string) {
  const normalized = email.toLowerCase()
  const existing = await db.select().from(users).where(eq(users.email, normalized)).limit(1)
  if (existing[0]) return existing[0]
  // Invite-only: only bootstrap owner may auto-create on first login before any invite
  const env = loadEnv()
  if (normalized === env.BOOTSTRAP_OWNER_EMAIL.toLowerCase()) {
    const passwordHash = await hashPassword(env.BOOTSTRAP_OWNER_PASSWORD)
    const [created] = await db
      .insert(users)
      .values({
        email: normalized,
        passwordHash,
        isSuperadmin: true,
        isBreakglassOperator: true,
        displayName: 'Bootstrap Owner',
      })
      .returning()
    await writeAudit({
      actorUserId: created!.id,
      action: 'bootstrap.owner_created',
      meta: { email: normalized },
    })
    return created!
  }
  const err = new Error('Invite required') as Error & { statusCode: number }
  err.statusCode = 403
  throw err
}

export async function createSession(
  userId: string,
  reply: { setCookie: (name: string, value: string, opts: Record<string, unknown>) => void },
) {
  const token = randomToken(32)
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  })
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId))
  reply.setCookie('bu2_session', token, {
    ...sessionCookieOpts(),
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

/** Shared cookie attrs so set + clear always match (path/SameSite/Secure). */
export function sessionCookieOpts() {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: loadEnv().NODE_ENV === 'production',
  }
}
