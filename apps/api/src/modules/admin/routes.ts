import type { FastifyInstance } from 'fastify'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/client.js'
import { auditLog, businesses, memberships, users } from '../../db/schema.js'
import { requireUser } from '../../plugins/auth.js'
import { writeAudit } from '../../lib/audit.js'

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (req, reply) => {
    if (!req.url.startsWith('/api/admin')) return
    const user = await requireUser(req).catch(() => null)
    if (!user?.isSuperadmin && !user?.isBreakglassOperator) {
      return reply.code(403).send({ error: 'superadmin_required' })
    }
  })

  app.get('/api/admin/overview', async (req) => {
    const user = await requireUser(req)
    const allUsers = await db.select().from(users)
    const allBiz = await db.select().from(businesses)
    const recentAudit = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(50)
    return {
      operator: {
        id: user.id,
        email: user.email,
        isSuperadmin: user.isSuperadmin,
        isBreakglassOperator: user.isBreakglassOperator,
      },
      counts: { users: allUsers.length, businesses: allBiz.length },
      users: allUsers.map((u) => ({
        id: u.id,
        email: u.email,
        isSuperadmin: u.isSuperadmin,
        isBreakglassOperator: u.isBreakglassOperator,
        lastLoginAt: u.lastLoginAt,
      })),
      businesses: allBiz,
      recentAudit,
    }
  })

  /** Breakglass: restore ownership after identity verification (audit required). */
  app.post('/api/admin/breakglass/restore-owner', async (req, reply) => {
    const operator = await requireUser(req)
    if (!operator.isBreakglassOperator) {
      return reply.code(403).send({ error: 'breakglass_required' })
    }
    const body = z
      .object({
        businessId: z.string().uuid(),
        newOwnerUserId: z.string().uuid(),
        reason: z.string().min(10).max(500),
        identityVerified: z.literal(true),
      })
      .parse(req.body)

    const biz = (
      await db.select().from(businesses).where(eq(businesses.id, body.businessId)).limit(1)
    )[0]
    if (!biz) return reply.code(404).send({ error: 'business_not_found' })

    const existing = await db
      .select()
      .from(memberships)
      .where(eq(memberships.businessId, body.businessId))

    const target = existing.find((m) => m.userId === body.newOwnerUserId)
    if (target) {
      await db.update(memberships).set({ role: 'owner' }).where(eq(memberships.id, target.id))
    } else {
      await db.insert(memberships).values({
        businessId: body.businessId,
        userId: body.newOwnerUserId,
        role: 'owner',
      })
    }

    await writeAudit({
      businessId: body.businessId,
      actorUserId: operator.id,
      action: 'breakglass.owner_restored',
      resourceRef: body.newOwnerUserId,
      meta: { reason: body.reason, identityVerified: true },
    })
    return { ok: true }
  })

  app.post('/api/admin/users/:id/flags', async (req, reply) => {
    const operator = await requireUser(req)
    if (!operator.isSuperadmin) return reply.code(403).send({ error: 'superadmin_required' })
    const { id } = req.params as { id: string }
    const body = z
      .object({
        isSuperadmin: z.boolean().optional(),
        isBreakglassOperator: z.boolean().optional(),
      })
      .parse(req.body)
    const [updated] = await db.update(users).set(body).where(eq(users.id, id)).returning()
    if (!updated) return reply.code(404).send({ error: 'not_found' })
    await writeAudit({
      actorUserId: operator.id,
      action: 'admin.user_flags_updated',
      resourceRef: id,
      meta: body,
    })
    return { user: updated }
  })
}
