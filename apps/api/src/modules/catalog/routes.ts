import type { FastifyInstance } from 'fastify'
import { and, eq, isNull } from 'drizzle-orm'
import { CatalogProductSchema, canMutateContent } from '@bu2/shared'
import { db } from '../../db/client.js'
import { catalogProducts } from '../../db/schema.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import { writeAudit } from '../../lib/audit.js'

export async function catalogRoutes(app: FastifyInstance) {
  app.get('/api/b/:slug/catalog', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const products = await db
      .select()
      .from(catalogProducts)
      .where(and(eq(catalogProducts.businessId, m.businessId), isNull(catalogProducts.archivedAt)))
    return { products }
  })

  app.post('/api/b/:slug/catalog', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    if (m.status === 'archived') return reply.code(409).send({ error: 'business_archived' })
    const body = CatalogProductSchema.parse(req.body)
    const [product] = await db
      .insert(catalogProducts)
      .values({
        businessId: m.businessId,
        name: body.name,
        sku: body.sku,
        description: body.description,
        currency: body.currency,
        netPriceCents: body.netPriceCents,
        taxRateBps: body.taxRateBps,
        active: body.active,
      })
      .returning()
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'catalog.product_created',
      resourceRef: product!.id,
    })
    return { product }
  })

  app.patch('/api/b/:slug/catalog/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const body = CatalogProductSchema.partial().parse(req.body)
    const [product] = await db
      .update(catalogProducts)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(catalogProducts.id, id), eq(catalogProducts.businessId, m.businessId)))
      .returning()
    if (!product) return reply.code(404).send({ error: 'not_found' })
    return { product }
  })

  app.delete('/api/b/:slug/catalog/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    await db
      .update(catalogProducts)
      .set({ archivedAt: new Date(), active: false, updatedAt: new Date() })
      .where(and(eq(catalogProducts.id, id), eq(catalogProducts.businessId, m.businessId)))
    return { ok: true }
  })
}
