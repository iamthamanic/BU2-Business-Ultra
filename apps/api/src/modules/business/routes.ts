/**
 * Business / membership / invite routes (platform create + owner + bundles).
 * Location: apps/api/src/modules/business/routes.ts
 */
import type { FastifyInstance } from 'fastify'
import { and, eq } from 'drizzle-orm'
import {
  CreateBusinessSchema,
  InviteSchema,
  UpdateBusinessSchema,
  canManageMembers,
  resolveEntitledTabs,
} from '@bu2/shared'
import { db } from '../../db/client.js'
import {
  businesses,
  invites,
  membershipBundles,
  memberships,
  socialDrafts,
  users,
} from '../../db/schema.js'
import { hashToken, randomToken } from '../../lib/crypto.js'
import { writeAudit } from '../../lib/audit.js'
import {
  assertCanCreateCompany,
  countActiveOwners,
  seedSystemBundles,
} from '../../lib/authorize.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import { seedDefaultAreaProjects } from '../projects/defaultAreas.js'
import { listBusinessesForUser } from './service.js'

export async function businessRoutes(app: FastifyInstance) {
  app.get('/api/businesses', async (req) => {
    const user = await requireUser(req)
    const rows = await listBusinessesForUser(user.id)
    return { businesses: rows }
  })

  app.post('/api/businesses', async (req, reply) => {
    const user = await requireUser(req)
    try {
      await assertCanCreateCompany(user.id)
    } catch {
      return reply.code(403).send({ error: 'platform_grant_required' })
    }
    const body = CreateBusinessSchema.parse(req.body)
    const [biz] = await db
      .insert(businesses)
      .values({
        name: body.name,
        slug: body.slug,
        createdByUserId: user.id,
      })
      .returning()
    if (!biz) return reply.code(500).send({ error: 'create_failed' })
    await db.insert(memberships).values({
      businessId: biz.id,
      userId: user.id,
      isOwner: true,
      status: 'active',
    })
    await seedSystemBundles(biz.id)
    await seedDefaultAreaProjects(biz.id, user.id)
    await writeAudit({
      businessId: biz.id,
      actorUserId: user.id,
      action: 'business.created',
      resourceRef: biz.slug,
    })
    return { business: biz }
  })

  app.get('/api/b/:slug', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    // No content superuser: superadmin without membership cannot see company data
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const rows = await db.select().from(businesses).where(eq(businesses.slug, slug)).limit(1)
    const biz = rows[0]
    if (!biz) return reply.code(404).send({ error: 'not_found' })
    const membership = {
      ...m,
      tabs: resolveEntitledTabs(m),
    }
    return { business: biz, membership }
  })

  app.patch('/api/b/:slug', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageMembers(m)) return reply.code(403).send({ error: 'forbidden' })
    const body = UpdateBusinessSchema.parse(req.body)
    const name = body.name.trim().replace(/\s+/g, ' ')
    if (!name) return reply.code(400).send({ error: 'invalid_name' })
    const [biz] = await db
      .update(businesses)
      .set({ name, updatedAt: new Date() })
      .where(eq(businesses.id, m.businessId))
      .returning()
    if (!biz) return reply.code(404).send({ error: 'not_found' })
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'business.updated',
      resourceRef: slug,
      meta: { name },
    })
    return { business: biz }
  })

  app.post('/api/b/:slug/invites', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageMembers(m)) return reply.code(403).send({ error: 'forbidden' })
    const body = InviteSchema.parse(req.body)
    const token = randomToken(24)
    const [inv] = await db
      .insert(invites)
      .values({
        businessId: m.businessId,
        email: body.email.toLowerCase(),
        bundleIds: body.bundleIds,
        tokenHash: hashToken(token),
        invitedByUserId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
      .returning()
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'invite.created',
      resourceRef: body.email,
    })
    return {
      invite: { id: inv!.id, email: inv!.email, bundleIds: inv!.bundleIds },
      acceptToken: token,
    }
  })

  app.post('/api/invites/accept', async (req, reply) => {
    const user = await requireUser(req)
    const { token } = req.body as { token: string }
    const rows = await db
      .select()
      .from(invites)
      .where(eq(invites.tokenHash, hashToken(token)))
      .limit(1)
    const inv = rows[0]
    if (!inv || inv.revokedAt || inv.acceptedAt || inv.expiresAt.getTime() < Date.now()) {
      return reply.code(400).send({ error: 'invalid_invite' })
    }
    if (inv.email !== user.email) return reply.code(403).send({ error: 'email_mismatch' })
    const [mem] = await db
      .insert(memberships)
      .values({
        businessId: inv.businessId,
        userId: user.id,
        isOwner: false,
        status: 'active',
      })
      .returning()
    if (mem && inv.bundleIds?.length) {
      await db.insert(membershipBundles).values(
        inv.bundleIds.map((bundleId) => ({
          membershipId: mem.id,
          bundleId,
        })),
      )
    }
    await db.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, inv.id))
    await writeAudit({
      businessId: inv.businessId,
      actorUserId: user.id,
      action: 'invite.accepted',
    })
    return { ok: true }
  })

  app.post('/api/b/:slug/archive', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m?.isOwner) return reply.code(403).send({ error: 'forbidden' })
    const drafts = await db
      .select()
      .from(socialDrafts)
      .where(and(eq(socialDrafts.businessId, m.businessId)))
    const blocking = drafts.filter((d) => {
      const rs = (d.remoteStatus ?? {}) as Record<string, { status?: string }>
      return Object.values(rs).some((v) =>
        ['scheduled', 'publishing', 'unknown'].includes(v?.status ?? ''),
      )
    })
    if (blocking.length) {
      return reply.code(409).send({
        error: 'archive_blocked_open_remote_posts',
        count: blocking.length,
      })
    }
    await db
      .update(businesses)
      .set({ status: 'archived', archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(businesses.id, m.businessId))
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'business.archived',
    })
    return { ok: true }
  })

  app.post('/api/b/:slug/reactivate', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m?.isOwner) return reply.code(403).send({ error: 'forbidden' })
    await db
      .update(businesses)
      .set({ status: 'active', archivedAt: null, updatedAt: new Date() })
      .where(eq(businesses.id, m.businessId))
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'business.reactivated',
    })
    return { ok: true }
  })

  app.delete('/api/b/:slug', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m?.isOwner) return reply.code(403).send({ error: 'forbidden' })
    const body = (req.body ?? {}) as { confirmSlug?: string }
    if (!body.confirmSlug || body.confirmSlug !== slug) {
      return reply.code(400).send({ error: 'confirm_slug_mismatch' })
    }
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'business.deleted',
      resourceRef: slug,
      meta: { slug },
    })
    await db.delete(businesses).where(eq(businesses.id, m.businessId))
    return { ok: true }
  })

  app.post('/api/b/:slug/owners', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m?.isOwner) return reply.code(403).send({ error: 'forbidden' })
    const { userId } = req.body as { userId: string }
    if (!userId) return reply.code(400).send({ error: 'userId_required' })
    const target = (
      await db
        .select()
        .from(memberships)
        .where(and(eq(memberships.businessId, m.businessId), eq(memberships.userId, userId)))
        .limit(1)
    )[0]
    if (!target) return reply.code(400).send({ error: 'target_must_be_member' })
    await db.update(memberships).set({ isOwner: true }).where(eq(memberships.id, target.id))
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'business.owner_added',
      resourceRef: userId,
    })
    return { ok: true }
  })

  app.delete('/api/b/:slug/owners/:userId', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, userId } = req.params as { slug: string; userId: string }
    const m = await loadMembership(user.id, slug)
    if (!m?.isOwner) return reply.code(403).send({ error: 'forbidden' })
    const owners = await countActiveOwners(m.businessId)
    if (owners <= 1) return reply.code(409).send({ error: 'last_owner_cannot_leave' })
    await db
      .update(memberships)
      .set({ isOwner: false })
      .where(and(eq(memberships.businessId, m.businessId), eq(memberships.userId, userId)))
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'business.owner_removed',
      resourceRef: userId,
    })
    return { ok: true }
  })

  app.delete('/api/b/:slug/members/:userId', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, userId } = req.params as { slug: string; userId: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageMembers(m)) return reply.code(403).send({ error: 'forbidden' })
    const target = (
      await db
        .select()
        .from(memberships)
        .where(and(eq(memberships.businessId, m.businessId), eq(memberships.userId, userId)))
        .limit(1)
    )[0]
    if (!target) return reply.code(404).send({ error: 'not_found' })
    if (target.isOwner) {
      const owners = await countActiveOwners(m.businessId)
      if (owners <= 1) return reply.code(409).send({ error: 'last_owner_cannot_leave' })
    }
    await db
      .delete(memberships)
      .where(and(eq(memberships.businessId, m.businessId), eq(memberships.userId, userId)))
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'membership.removed',
      resourceRef: userId,
    })
    return { ok: true }
  })

  app.get('/api/b/:slug/members', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const rows = await db
      .select({
        id: memberships.id,
        isOwner: memberships.isOwner,
        status: memberships.status,
        email: users.email,
        displayName: users.displayName,
        userId: users.id,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.businessId, m.businessId))

    const withBundles = []
    for (const row of rows) {
      const links = await db
        .select({ bundleId: membershipBundles.bundleId })
        .from(membershipBundles)
        .where(eq(membershipBundles.membershipId, row.id))
      withBundles.push({ ...row, bundleIds: links.map((l) => l.bundleId) })
    }
    return { members: withBundles }
  })
}
