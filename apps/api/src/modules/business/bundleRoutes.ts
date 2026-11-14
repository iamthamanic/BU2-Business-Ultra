/**
 * Permission bundle CRUD + membership assignment.
 * Location: apps/api/src/modules/business/bundleRoutes.ts
 */
import type { FastifyInstance } from 'fastify'
import { and, eq } from 'drizzle-orm'
import {
  BundleCreateSchema,
  BundleUpdateSchema,
  MembershipBundlesAssignSchema,
  PERMISSION_KEYS,
  canManageMembers,
  hasPermission,
} from '@bu2/shared'
import { db } from '../../db/client.js'
import {
  bundlePermissions,
  membershipBundles,
  memberships,
  permissionBundles,
} from '../../db/schema.js'
import { assertGrantSubset } from '../../lib/authorize.js'
import { writeAudit } from '../../lib/audit.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'

export async function bundleRoutes(app: FastifyInstance) {
  app.get('/api/b/:slug/permissions/catalog', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    return { permissions: [...PERMISSION_KEYS] }
  })

  app.get('/api/b/:slug/bundles', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const bundles = await db
      .select()
      .from(permissionBundles)
      .where(eq(permissionBundles.businessId, m.businessId))
    const out = []
    for (const b of bundles) {
      const perms = await db
        .select({ key: bundlePermissions.permissionKey })
        .from(bundlePermissions)
        .where(eq(bundlePermissions.bundleId, b.id))
      out.push({ ...b, permissions: perms.map((p) => p.key) })
    }
    return { bundles: out }
  })

  app.post('/api/b/:slug/bundles', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'members.permissions.manage')) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    const body = BundleCreateSchema.parse(req.body)
    assertGrantSubset(m, body.permissions)
    const [bundle] = await db
      .insert(permissionBundles)
      .values({
        businessId: m.businessId,
        name: body.name,
        description: body.description ?? null,
        isSystem: false,
      })
      .returning()
    if (!bundle) return reply.code(500).send({ error: 'create_failed' })
    await db.insert(bundlePermissions).values(
      body.permissions.map((permissionKey) => ({
        bundleId: bundle.id,
        permissionKey,
      })),
    )
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'permissions.bundle.changed',
      resourceRef: bundle.id,
      meta: { op: 'create', count: body.permissions.length },
    })
    return { bundle: { ...bundle, permissions: body.permissions } }
  })

  app.patch('/api/b/:slug/bundles/:bundleId', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, bundleId } = req.params as { slug: string; bundleId: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'members.permissions.manage')) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    const body = BundleUpdateSchema.parse(req.body)
    const existing = (
      await db
        .select()
        .from(permissionBundles)
        .where(
          and(eq(permissionBundles.id, bundleId), eq(permissionBundles.businessId, m.businessId)),
        )
        .limit(1)
    )[0]
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    if (existing.version !== body.version) {
      return reply.code(409).send({ error: 'version_conflict' })
    }
    if (body.permissions) assertGrantSubset(m, body.permissions)

    const [updated] = await db
      .update(permissionBundles)
      .set({
        name: body.name ?? existing.name,
        description:
          body.description === undefined ? existing.description : body.description,
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(permissionBundles.id, bundleId))
      .returning()

    if (body.permissions) {
      await db.delete(bundlePermissions).where(eq(bundlePermissions.bundleId, bundleId))
      await db.insert(bundlePermissions).values(
        body.permissions.map((permissionKey) => ({
          bundleId,
          permissionKey,
        })),
      )
    }

    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'permissions.bundle.changed',
      resourceRef: bundleId,
      meta: { op: 'update' },
    })
    return { bundle: updated }
  })

  app.delete('/api/b/:slug/bundles/:bundleId', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, bundleId } = req.params as { slug: string; bundleId: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'members.permissions.manage')) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    const existing = (
      await db
        .select()
        .from(permissionBundles)
        .where(
          and(eq(permissionBundles.id, bundleId), eq(permissionBundles.businessId, m.businessId)),
        )
        .limit(1)
    )[0]
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    if (existing.isSystem) return reply.code(400).send({ error: 'system_bundle_locked' })
    await db.delete(permissionBundles).where(eq(permissionBundles.id, bundleId))
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'permissions.bundle.changed',
      resourceRef: bundleId,
      meta: { op: 'delete' },
    })
    return { ok: true }
  })

  app.put('/api/b/:slug/members/:userId/bundles', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, userId } = req.params as { slug: string; userId: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canManageMembers(m)) return reply.code(403).send({ error: 'forbidden' })
    const body = MembershipBundlesAssignSchema.parse({
      ...(req.body as object),
      userId,
    })

    const target = (
      await db
        .select()
        .from(memberships)
        .where(and(eq(memberships.businessId, m.businessId), eq(memberships.userId, userId)))
        .limit(1)
    )[0]
    if (!target) return reply.code(404).send({ error: 'not_found' })
    if (target.isOwner) {
      return reply.code(400).send({ error: 'owner_uses_owner_status' })
    }

    // Validate bundles belong to this business and subset of actor grants
    for (const bundleId of body.bundleIds) {
      const b = (
        await db
          .select()
          .from(permissionBundles)
          .where(
            and(
              eq(permissionBundles.id, bundleId),
              eq(permissionBundles.businessId, m.businessId),
            ),
          )
          .limit(1)
      )[0]
      if (!b) return reply.code(400).send({ error: 'invalid_bundle' })
      const keys = await db
        .select({ key: bundlePermissions.permissionKey })
        .from(bundlePermissions)
        .where(eq(bundlePermissions.bundleId, bundleId))
      assertGrantSubset(
        m,
        keys.map((k) => k.key),
      )
    }

    await db.delete(membershipBundles).where(eq(membershipBundles.membershipId, target.id))
    if (body.bundleIds.length) {
      await db.insert(membershipBundles).values(
        body.bundleIds.map((bundleId) => ({
          membershipId: target.id,
          bundleId,
        })),
      )
    }
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'membership.bundles_updated',
      resourceRef: userId,
      meta: { bundleIds: body.bundleIds },
    })
    return { ok: true, bundleIds: body.bundleIds }
  })
}
