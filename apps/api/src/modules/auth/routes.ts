/**
 * Auth routes: Better Auth wrappers + bootstrap + /me.
 * Location: apps/api/src/modules/auth/routes.ts
 */
import type { FastifyInstance, FastifyReply } from 'fastify'
import { fromNodeHeaders } from 'better-auth/node'
import {
  BootstrapSetupSchema,
  ChangePasswordSchema,
  MagicLinkRequestSchema,
  OtpVerifySchema,
  PasswordLoginSchema,
} from '@bu2/shared'
import { auth } from '../../lib/betterAuth.js'
import { hasPlatformCapability } from '../../lib/authorize.js'
import { requireUser } from '../../plugins/auth.js'
import { writeAudit } from '../../lib/audit.js'
import { isBootstrapRequired, runBootstrap } from './bootstrap.js'

const authLoginLimit = { max: 20, timeWindow: '1 minute' as const }
const authChallengeLimit = { max: 10, timeWindow: '1 minute' as const }
const authSessionLimit = { max: 60, timeWindow: '1 minute' as const }

async function applyAuthResponse(reply: FastifyReply, response: Response) {
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      reply.header('set-cookie', value)
    }
  })
  const text = await response.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return reply.code(response.status).send(body)
}

export async function authRoutes(app: FastifyInstance) {
  app.get('/api/setup/status', { config: { rateLimit: authSessionLimit } }, async () => {
    return { required: await isBootstrapRequired() }
  })

  app.post('/api/setup', { config: { rateLimit: authChallengeLimit } }, async (req, reply) => {
    try {
      const body = BootstrapSetupSchema.parse(req.body)
      const result = await runBootstrap(body)
      // Auto sign-in after bootstrap
      const signIn = await auth.api.signInEmail({
        body: { email: body.email, password: body.password },
        asResponse: true,
      })
      if (signIn instanceof Response) {
        signIn.headers.forEach((value, key) => {
          if (key.toLowerCase() === 'set-cookie') reply.header('set-cookie', value)
        })
      }
      return { ok: true, ...result }
    } catch (e) {
      const err = e as Error & { statusCode?: number }
      return reply.code(err.statusCode ?? 400).send({ error: err.message })
    }
  })

  app.post('/api/auth/login', { config: { rateLimit: authLoginLimit } }, async (req, reply) => {
    const body = PasswordLoginSchema.parse(req.body)
    const response = await auth.api.signInEmail({
      body: { email: body.email.toLowerCase(), password: body.password },
      asResponse: true,
    })
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') reply.header('set-cookie', value)
    })
    if (!response.ok) {
      return reply.code(401).send({ error: 'invalid_credentials' })
    }
    const cookieHeader =
      response.headers.getSetCookie?.()?.join('; ') ?? response.headers.get('set-cookie') ?? ''
    const session = await auth.api
      .getSession({ headers: fromNodeHeaders({ cookie: cookieHeader }) })
      .catch(() => null)
    if (!session?.user?.id) {
      return reply.code(401).send({ error: 'invalid_credentials' })
    }
    const { eq } = await import('drizzle-orm')
    const { db } = await import('../../db/client.js')
    const { users } = await import('../../db/schema.js')
    const rows = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1)
    const u = rows[0]
    if (!u || u.status !== 'active') {
      return reply.code(401).send({ error: 'invalid_credentials' })
    }
    await writeAudit({
      actorUserId: u.id,
      action: 'auth.login',
      meta: { method: 'password' },
    })
    const canCreateCompanies = await hasPlatformCapability(u.id, 'companies.create')
    return {
      ok: true,
      user: {
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        isSuperadmin: u.isSuperadmin,
        isBreakglassOperator: u.isBreakglassOperator,
        locale: u.locale,
        platformCapabilities: {
          'companies.create': canCreateCompanies,
        },
      },
    }
  })

  app.post('/api/auth/password', { config: { rateLimit: authLoginLimit } }, async (req, reply) => {
    const actor = await requireUser(req).catch(() => null)
    if (!actor) return reply.code(401).send({ error: 'unauthorized' })
    const body = ChangePasswordSchema.parse(req.body)
    try {
      await auth.api.changePassword({
        body: {
          newPassword: body.newPassword,
          currentPassword: body.currentPassword ?? '',
        },
        headers: fromNodeHeaders(req.headers),
      })
      await writeAudit({ actorUserId: actor.id, action: 'auth.password_changed', meta: {} })
      return { ok: true }
    } catch {
      return reply.code(400).send({ error: 'password_change_failed' })
    }
  })

  app.post('/api/auth/magic-link', { config: { rateLimit: authChallengeLimit } }, async (req, reply) => {
    const body = MagicLinkRequestSchema.parse(req.body)
    try {
      await auth.api.signInMagicLink({
        body: {
          email: body.email.toLowerCase(),
          callbackURL: `${process.env.PUBLIC_WEB_URL ?? 'http://127.0.0.1:8741'}/login/verify`,
        },
        headers: fromNodeHeaders(req.headers),
      })
    } catch {
      // Invite-only / unknown email — always 200 (no enumeration)
    }
    return { ok: true, mode: 'queued' }
  })

  app.post('/api/auth/verify-otp', { config: { rateLimit: authChallengeLimit } }, async (req, reply) => {
    const body = OtpVerifySchema.parse(req.body)
    const response = await auth.api.signInEmailOTP({
      body: { email: body.email.toLowerCase(), otp: body.code },
      asResponse: true,
    })
    return applyAuthResponse(reply, response)
  })

  app.post('/api/auth/logout', { config: { rateLimit: authSessionLimit } }, async (req, reply) => {
    const response = await auth.api.signOut({
      headers: fromNodeHeaders(req.headers),
      asResponse: true,
    })
    return applyAuthResponse(reply, response)
  })

  app.get('/api/auth/me', { config: { rateLimit: authSessionLimit } }, async (req, reply) => {
    const user = await requireUser(req).catch(() => null)
    if (!user) return reply.code(401).send({ error: 'unauthorized' })
    const canCreateCompanies = await hasPlatformCapability(user.id, 'companies.create')
    return {
      user: {
        ...user,
        platformCapabilities: {
          'companies.create': canCreateCompanies,
        },
      },
    }
  })

  // Catch-all for Better Auth plugin routes (magic-link verify, OTP send, etc.)
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    config: { rateLimit: authChallengeLimit },
    async handler(request, reply) {
      const url = new URL(request.url, `http://${request.headers.host}`)
      const headers = fromNodeHeaders(request.headers)
      const init: RequestInit = {
        method: request.method,
        headers,
      }
      if (request.method !== 'GET' && request.method !== 'HEAD' && request.body != null) {
        init.body = JSON.stringify(request.body)
        headers.set('content-type', 'application/json')
      }
      const req = new Request(url.toString(), init)
      const response = await auth.handler(req)
      return applyAuthResponse(reply, response)
    },
  })
}
