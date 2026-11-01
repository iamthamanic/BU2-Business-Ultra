import type { FastifyInstance, FastifyRequest } from 'fastify'
import { eq, and, isNull } from 'drizzle-orm'
import type { Role } from '@bu2/shared'
import { db } from '../db/client.js'
import { businesses, memberships, sessions, users } from '../db/schema.js'
import { hashToken } from '../lib/crypto.js'

export type AuthUser = {
  id: string
  email: string
  displayName: string | null
  isSuperadmin: boolean
  isBreakglassOperator: boolean
  locale: string
}

export type MembershipCtx = {
  businessId: string
  slug: string
  role: Role
  grantSeoOpen: boolean
  status: string
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null
    membership: MembershipCtx | null
  }
}

async function loadUserFromCookie(req: FastifyRequest): Promise<AuthUser | null> {
  const token = req.cookies.bu2_session
  if (!token) return null
  const tokenHash = hashToken(token)
  const rows = await db
    .select({
      expiresAt: sessions.expiresAt,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  if (row.expiresAt.getTime() < Date.now()) return null
  return {
    id: row.user.id,
    email: row.user.email,
    displayName: row.user.displayName,
    isSuperadmin: row.user.isSuperadmin,
    isBreakglassOperator: row.user.isBreakglassOperator,
    locale: row.user.locale,
  }
}

export async function requireUser(req: FastifyRequest): Promise<AuthUser> {
  if (!req.user) {
    const err = new Error('Unauthorized') as Error & { statusCode: number }
    err.statusCode = 401
    throw err
  }
  return req.user
}

export function requireRole(membership: MembershipCtx, allowed: Role[]): void {
  if (!allowed.includes(membership.role)) {
    const err = new Error('Forbidden') as Error & { statusCode: number }
    err.statusCode = 403
    throw err
  }
}

export async function loadMembership(
  userId: string,
  slug: string,
): Promise<MembershipCtx | null> {
  const rows = await db
    .select({
      businessId: businesses.id,
      slug: businesses.slug,
      status: businesses.status,
      role: memberships.role,
      grantSeoOpen: memberships.grantSeoOpen,
    })
    .from(businesses)
    .innerJoin(memberships, eq(memberships.businessId, businesses.id))
    .where(and(eq(businesses.slug, slug), eq(memberships.userId, userId)))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return {
    businessId: row.businessId,
    slug: row.slug,
    role: row.role as Role,
    grantSeoOpen: row.grantSeoOpen,
    status: row.status,
  }
}

export async function registerAuth(app: FastifyInstance) {
  app.decorateRequest('user', null)
  app.decorateRequest('membership', null)
  app.addHook('preHandler', async (req) => {
    req.user = await loadUserFromCookie(req)
  })
}
