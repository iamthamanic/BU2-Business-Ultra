/**
 * Auth routes: password login, magic-link/OTP, session, password change.
 * Location: apps/api/src/modules/auth/routes.ts
 */
import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import {
  ChangePasswordSchema,
  MagicLinkRequestSchema,
  MagicLinkVerifySchema,
  OtpVerifySchema,
  PasswordLoginSchema,
} from '@bu2/shared'
import { db } from '../../db/client.js'
import { authChallenges, sessions, users } from '../../db/schema.js'
import { hashToken, randomOtp, randomToken } from '../../lib/crypto.js'
import { hashPassword, verifyPassword } from '../../lib/password.js'
import { sendMagicLinkEmail } from '../../lib/brevo.js'
import { loadEnv } from '../../lib/env.js'
import { writeAudit } from '../../lib/audit.js'
import { requireUser } from '../../plugins/auth.js'

const SESSION_DAYS = 14

async function ensureUser(email: string) {
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

async function createSession(userId: string, reply: { setCookie: (name: string, value: string, opts: Record<string, unknown>) => void }) {
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
function sessionCookieOpts() {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: loadEnv().NODE_ENV === 'production',
  }
}

export async function authRoutes(app: FastifyInstance) {
  /** Primary: email + password → session cookie */
  app.post('/api/auth/login', async (req, reply) => {
    const body = PasswordLoginSchema.parse(req.body)
    const email = body.email.toLowerCase()
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1)
    const user = rows[0]
    // Uniform error — avoid email enumeration
    if (!user?.passwordHash) {
      return reply.code(401).send({ error: 'invalid_credentials' })
    }
    const ok = await verifyPassword(body.password, user.passwordHash)
    if (!ok) {
      return reply.code(401).send({ error: 'invalid_credentials' })
    }
    await createSession(user.id, reply)
    await writeAudit({ actorUserId: user.id, action: 'auth.login', meta: { method: 'password' } })
    return { ok: true, user: { id: user.id, email: user.email } }
  })

  /** Set or change password for the logged-in user */
  app.post('/api/auth/password', async (req, reply) => {
    const actor = await requireUser(req).catch(() => null)
    if (!actor) return reply.code(401).send({ error: 'unauthorized' })
    const body = ChangePasswordSchema.parse(req.body)
    const rows = await db.select().from(users).where(eq(users.id, actor.id)).limit(1)
    const user = rows[0]
    if (!user) return reply.code(401).send({ error: 'unauthorized' })

    if (user.passwordHash) {
      if (!body.currentPassword) {
        return reply.code(400).send({ error: 'current_password_required' })
      }
      const match = await verifyPassword(body.currentPassword, user.passwordHash)
      if (!match) {
        return reply.code(401).send({ error: 'invalid_credentials' })
      }
    }

    const passwordHash = await hashPassword(body.newPassword)
    await db.update(users).set({ passwordHash }).where(eq(users.id, user.id))
    await writeAudit({ actorUserId: user.id, action: 'auth.password_changed', meta: {} })
    return { ok: true }
  })

  app.post('/api/auth/magic-link', async (req, reply) => {
    const body = MagicLinkRequestSchema.parse(req.body)
    const email = body.email.toLowerCase()
    // Existence check without enumeration: always 200
    try {
      await ensureUser(email)
    } catch (e) {
      const err = e as Error & { statusCode?: number }
      if (err.statusCode === 403) {
        return reply.code(200).send({ ok: true, mode: 'queued' })
      }
      throw e
    }
    const token = randomToken(24)
    const otp = randomOtp()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
    await db.insert(authChallenges).values({
      email,
      tokenHash: hashToken(token),
      otpHash: hashToken(otp),
      expiresAt,
    })
    const env = loadEnv()
    const magicUrl = `${env.PUBLIC_WEB_URL}/login/verify?token=${encodeURIComponent(token)}`
    const sent = await sendMagicLinkEmail({ to: email, magicUrl, otp })
    await writeAudit({ action: 'auth.magic_link_requested', meta: { email, mode: sent.mode } })
    return { ok: true, mode: sent.mode }
  })

  app.post('/api/auth/verify', async (req, reply) => {
    const body = MagicLinkVerifySchema.parse(req.body)
    const rows = await db
      .select()
      .from(authChallenges)
      .where(eq(authChallenges.tokenHash, hashToken(body.token)))
      .limit(1)
    const challenge = rows[0]
    if (!challenge || challenge.consumedAt || challenge.expiresAt.getTime() < Date.now()) {
      return reply.code(400).send({ error: 'invalid_or_expired' })
    }
    await db
      .update(authChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(authChallenges.id, challenge.id))
    const user = await ensureUser(challenge.email)
    await createSession(user.id, reply)
    await writeAudit({ actorUserId: user.id, action: 'auth.login', meta: { method: 'magic_link' } })
    return { ok: true, user: { id: user.id, email: user.email } }
  })

  app.post('/api/auth/verify-otp', async (req, reply) => {
    const body = OtpVerifySchema.parse(req.body)
    const email = body.email.toLowerCase()
    const rows = await db.select().from(authChallenges).where(eq(authChallenges.email, email))
    const challenge = rows
      .filter((c) => !c.consumedAt && c.expiresAt.getTime() >= Date.now())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
    if (!challenge?.otpHash || challenge.otpHash !== hashToken(body.code)) {
      return reply.code(400).send({ error: 'invalid_or_expired' })
    }
    await db
      .update(authChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(authChallenges.id, challenge.id))
    const user = await ensureUser(email)
    await createSession(user.id, reply)
    await writeAudit({ actorUserId: user.id, action: 'auth.login', meta: { method: 'otp' } })
    return { ok: true, user: { id: user.id, email: user.email } }
  })

  app.post('/api/auth/logout', async (req, reply) => {
    const token = req.cookies.bu2_session
    if (token) {
      await db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(eq(sessions.tokenHash, hashToken(token)))
    }
    // Match setCookie attributes exactly so browsers drop bu2_session
    reply.clearCookie('bu2_session', sessionCookieOpts())
    return { ok: true }
  })

  app.get('/api/auth/me', async (req, reply) => {
    const user = await requireUser(req).catch(() => null)
    if (!user) return reply.code(401).send({ error: 'unauthorized' })
    return { user }
  })

  /** Dev/test only — returns last OTP for an email (never enable in production). */
  app.post('/api/auth/dev/last-otp', async (req, reply) => {
    const env = loadEnv()
    if (env.NODE_ENV === 'production') {
      return reply.code(404).send({ error: 'not_found' })
    }
    const body = MagicLinkRequestSchema.parse(req.body)
    const email = body.email.toLowerCase()
    const rows = await db.select().from(authChallenges).where(eq(authChallenges.email, email))
    const challenge = rows
      .filter((c) => !c.consumedAt && c.expiresAt.getTime() >= Date.now())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
    if (!challenge) return reply.code(404).send({ error: 'no_challenge' })
    // OTP itself is hashed — store plaintext otp in meta is avoided; re-issue for tests
    const otp = randomOtp()
    await db
      .update(authChallenges)
      .set({ otpHash: hashToken(otp) })
      .where(eq(authChallenges.id, challenge.id))
    return { code: otp, email }
  })
}
