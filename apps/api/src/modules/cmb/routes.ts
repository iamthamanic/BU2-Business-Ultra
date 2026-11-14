import type { FastifyInstance } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import {
    calculateModel,
    simpleProductFixture,
    TEMPLATES,
    type DomainModel,
  } from '@bu2/finance-calc'
import { canMutateContent } from '@bu2/shared'
import { db } from '../../db/client.js'
import { cmbModels, cmbSnapshots } from '../../db/schema.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import { writeAudit } from '../../lib/audit.js'

export async function cmbRoutes(app: FastifyInstance) {
  app.get('/api/b/:slug/cmb/templates', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    return {
      templates: Object.entries(TEMPLATES).map(([key, model]) => ({
        key,
        id: model.id,
        name: key,
        volume: model.volume,
      })),
    }
  })

  app.get('/api/b/:slug/cmb/models', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const models = await db.select().from(cmbModels).where(eq(cmbModels.businessId, m.businessId))
    return { models }
  })

  app.post('/api/b/:slug/cmb/models', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
    const body = z
      .object({
        name: z.string().min(1),
        model: z.record(z.unknown()).optional(),
        useSimpleFixture: z.boolean().optional(),
        template: z.enum(['simple', 'saas', 'service']).optional(),
      })
      .parse(req.body)
    const model = (
      body.template
        ? TEMPLATES[body.template]
        : body.useSimpleFixture
          ? simpleProductFixture
          : (body.model as unknown as DomainModel)
    ) as DomainModel
    const [row] = await db
      .insert(cmbModels)
      .values({
        businessId: m.businessId,
        name: body.name,
        model: model as unknown as Record<string, unknown>,
      })
      .returning()
    return { model: row }
  })

  app.post('/api/b/:slug/cmb/models/:id/calculate', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const rows = await db
      .select()
      .from(cmbModels)
      .where(and(eq(cmbModels.id, id), eq(cmbModels.businessId, m.businessId)))
      .limit(1)
    const row = rows[0]
    if (!row) return reply.code(404).send({ error: 'not_found' })
    const snapshot = calculateModel(row.model as unknown as DomainModel)
    const [saved] = await db
      .insert(cmbSnapshots)
      .values({
        businessId: m.businessId,
        modelId: row.id,
        snapshot: snapshot as unknown as Record<string, unknown>,
      })
      .returning()
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'finance.snapshot_created',
      resourceRef: saved!.id,
    })
    return { snapshot, savedId: saved!.id }
  })

  app.get('/api/b/:slug/cmb/models/:id/snapshots', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const snaps = await db
      .select()
      .from(cmbSnapshots)
      .where(and(eq(cmbSnapshots.modelId, id), eq(cmbSnapshots.businessId, m.businessId)))
    return { snapshots: snaps }
  })

  app.post('/api/cmb/simulate', async (req) => {
    // Pure simulation endpoint (no persistence) for golden checks / UI preview
    const body = z.object({ model: z.record(z.unknown()) }).parse(req.body)
    const snapshot = calculateModel(body.model as unknown as DomainModel)
    return { snapshot }
  })
}
