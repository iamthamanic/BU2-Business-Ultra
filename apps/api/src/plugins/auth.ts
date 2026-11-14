/**
 * AuthN plugin — Better Auth session → req.user; membership via authorize resolver.
 * Location: apps/api/src/plugins/auth.ts
 */
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { fromNodeHeaders } from 'better-auth/node'
import { db } from '../db/client.js'
import { businesses, memberships, users } from '../db/schema.js'
import { auth } from '../lib/betterAuth.js'
import { buildMembershipCtx, type MembershipCtx } from '../lib/authorize.js'

export type AuthUser = {
  id: string
  email: string
  displayName: string | null
  isSuperadmin: boolean
  isBreakglassOperator: boolean
  locale: string
  status: string
}

export type { MembershipCtx }

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null
    membership: MembershipCtx | null
  }
}

async function loadUserFromSession(req: FastifyRequest): Promise<AuthUser | null> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  })
  if (!session?.user?.id) return null
  const rows = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1)
  const profile = rows[0]
  if (!profile) {
    // Sync race: session exists before profile row — create minimal profile
    await db.insert(users).values({
      id: session.user.id,
      email: session.user.email.toLowerCase(),
      displayName: session.user.name || null,
      emailVerified: Boolean(session.user.emailVerified),
    })
    return {
      id: session.user.id,
      email: session.user.email.toLowerCase(),
      displayName: session.user.name || null,
      isSuperadmin: false,
      isBreakglassOperator: false,
      locale: 'de',
      status: 'active',
    }
  }
  if (profile.status !== 'active') return null
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.displayName,
    isSuperadmin: profile.isSuperadmin,
    isBreakglassOperator: profile.isBreakglassOperator,
    locale: profile.locale,
    status: profile.status,
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

export async function loadMembership(
  userId: string,
  slug: string,
): Promise<MembershipCtx | null> {
  const rows = await db
    .select({
      membershipId: memberships.id,
      businessId: businesses.id,
      slug: businesses.slug,
      businessStatus: businesses.status,
      isOwner: memberships.isOwner,
      membershipStatus: memberships.status,
    })
    .from(businesses)
    .innerJoin(
      memberships,
      and(eq(memberships.businessId, businesses.id), eq(memberships.userId, userId)),
    )
    .where(eq(businesses.slug, slug))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return buildMembershipCtx(row)
}

/** Membership by business UUID (e.g. media downloads keyed by id, not slug). */
export async function loadMembershipByBusinessId(
  userId: string,
  businessId: string,
): Promise<MembershipCtx | null> {
  const rows = await db
    .select({
      membershipId: memberships.id,
      businessId: businesses.id,
      slug: businesses.slug,
      businessStatus: businesses.status,
      isOwner: memberships.isOwner,
      membershipStatus: memberships.status,
    })
    .from(businesses)
    .innerJoin(
      memberships,
      and(eq(memberships.businessId, businesses.id), eq(memberships.userId, userId)),
    )
    .where(eq(businesses.id, businessId))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return buildMembershipCtx(row)
}

export async function registerAuth(app: FastifyInstance) {
  app.decorateRequest('user', null)
  app.decorateRequest('membership', null)
  app.addHook('preHandler', async (req) => {
    req.user = await loadUserFromSession(req)
  })
}
