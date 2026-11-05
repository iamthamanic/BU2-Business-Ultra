import type { FastifyInstance } from 'fastify'
import { and, eq } from 'drizzle-orm'
import {
  CreateBusinessSchema,
  InviteSchema,
  UpdateBusinessSchema,
  canManageMembers,
  resolveEntitledTabs,
  type Role,
} from '@bu2/shared'
import { db } from '../../db/client.js'
import { businesses, invites, memberships, socialDrafts, users } from '../../db/schema.js'
import { hashToken, randomToken } from '../../lib/crypto.js'
import { writeAudit } from '../../lib/audit.js'
import { loadMembership, requireRole, requireUser } from '../../plugins/auth.js'
import { seedDefaultAreaProjects } from '../projects/defaultAreas.js'
import { listBusinessesForUser } from './service.js'

export async function businessRoutes(app: FastifyInstance) {
  app.get('/api/businesses', async (req, reply) => {
    const user = await requireUser(req)
    const rows = await listBusinessesForUser(user.id)
    return { businesses: rows }
  })

  app.post('/api/businesses', async (req, reply) => {
    const user = await requireUser(req)
    // Superadmin, existing owner, or zero-membership bootstrap (create-first) may create.
    const owned = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.userId, user.id), eq(memberships.role, 'owner')))
      .limit(1)
    if (!owned[0] && !user.isSuperadmin) {
      const anyMembership = await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(eq(memberships.userId, user.id))
        .limit(1)
      if (anyMembership[0]) {
        return reply.code(403).send({ error: 'owner_required_to_create_business' })
      }
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
    await db.insert(memberships).values({
      businessId: biz!.id,
      userId: user.id,
      role: 'owner',
    })
    await seedDefaultAreaProjects(biz!.id, user.id)
    await writeAudit({
      businessId: biz!.id,
      actorUserId: user.id,
      action: 'business.created',
      resourceRef: biz!.slug,
    })
    return { business: biz }
  })

  app.get('/api/b/:slug', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m && !user.isSuperadmin) return reply.code(404).send({ error: 'not_found' })
    const rows = await db.select().from(businesses).where(eq(businesses.slug, slug)).limit(1)
    const biz = rows[0]
    if (!biz) return reply.code(404).send({ error: 'not_found' })
    // Legacy ME.tabs parity: owner/admin unrestricted (null); others get stub entitlements
    const membership = m
      ? {
          ...m,
          tabs: user.isSuperadmin ? null : resolveEntitledTabs(m.role as Role),
        }
      : null
    return { business: biz, membership }
  })

  app.patch('/api/b/:slug', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageMembers(m.role)) return reply.code(403).send({ error: 'forbidden' })
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
    if (!m || !canManageMembers(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const body = InviteSchema.parse(req.body)
    const token = randomToken(24)
    const [inv] = await db
      .insert(invites)
      .values({
        businessId: m.businessId,
        email: body.email.toLowerCase(),
        role: body.role,
        tokenHash: hashToken(token),
        invitedByUserId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
      .returning()
    // Ensure user shell exists for invitee so magic-link works
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, body.email.toLowerCase()))
      .limit(1)
    if (!existing[0]) {
      await db.insert(users).values({ email: body.email.toLowerCase() })
    }
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'invite.created',
      resourceRef: body.email,
    })
    return { invite: { id: inv!.id, email: inv!.email, role: inv!.role }, acceptToken: token }
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
    await db.insert(memberships).values({
      businessId: inv.businessId,
      userId: user.id,
      role: inv.role,
    })
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
    if (!m) return reply.code(404).send({ error: 'not_found' })
    requireRole(m, ['owner'])
    // Archive preflight: block if scheduled remote posts remain
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
    if (!m) return reply.code(404).send({ error: 'not_found' })
    requireRole(m, ['owner'])
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

  /** Permanent delete — owner must send confirmSlug matching the company slug. */
  app.delete('/api/b/:slug', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    requireRole(m, ['owner'])
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

  app.post('/api/b/:slug/transfer-owner', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    requireRole(m, ['owner'])
    const { newOwnerUserId } = (req.body as { newOwnerUserId: string })
    if (!newOwnerUserId) return reply.code(400).send({ error: 'newOwnerUserId_required' })
    const target = (
      await db
        .select()
        .from(memberships)
        .where(and(eq(memberships.businessId, m.businessId), eq(memberships.userId, newOwnerUserId)))
        .limit(1)
    )[0]
    if (!target) return reply.code(400).send({ error: 'target_must_be_member' })
    await db.update(memberships).set({ role: 'owner' }).where(eq(memberships.id, target.id))
    await db.update(memberships).set({ role: 'admin' }).where(eq(memberships.id, (
      await db.select().from(memberships).where(and(eq(memberships.businessId, m.businessId), eq(memberships.userId, user.id))).limit(1)
    )[0]!.id))
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'business.owner_transferred',
      resourceRef: newOwnerUserId,
    })
    return { ok: true }
  })

  app.delete('/api/b/:slug/members/:userId', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, userId } = req.params as { slug: string; userId: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageMembers(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const owners = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.businessId, m.businessId), eq(memberships.role, 'owner')))
    const victim = owners.find((o) => o.userId === userId)
    if (victim && owners.length <= 1) {
      return reply.code(409).send({ error: 'last_owner_cannot_leave' })
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
        role: memberships.role,
        grantSeoOpen: memberships.grantSeoOpen,
        grantToolsUse: memberships.grantToolsUse,
        grantToolsManage: memberships.grantToolsManage,
        email: users.email,
        displayName: users.displayName,
        userId: users.id,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.businessId, m.businessId))
    return { members: rows }
  })
}
