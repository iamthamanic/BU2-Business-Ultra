/**
 * Customer engagement HTTP — stats, purchases, consents, communication log.
 * Location: apps/api/src/modules/customers/engagementRoutes.ts
 */
import type { FastifyInstance } from 'fastify'
import { and, eq } from 'drizzle-orm'
import {
  CustomerCommLogSchema,
  CustomerConsentSchema,
  CustomerPurchaseSchema,
  CustomerStatsPatchSchema,
  canMutateContent,
} from '@bu2/shared'
import { db } from '../../db/client.js'
import {
  customerConsents,
  customerEvents,
  customerNotes,
  customerPurchases,
  customers,
  personas,
  products,
} from '../../db/schema.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import { addEvent, loadCustomer, loadCustomerStats, toCustomer } from './service.js'

export async function registerEngagementRoutes(app: FastifyInstance) {
  app.get('/api/b/:slug/customers/:id/stats', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const existing = await loadCustomer(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    return { stats: await loadCustomerStats(m.businessId, existing) }
  })

  app.patch('/api/b/:slug/customers/:id/stats', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadCustomer(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    const body = CustomerStatsPatchSchema.parse(req.body)
    if (body.buyerPersonaId) {
      const [persona] = await db
        .select({ id: personas.id })
        .from(personas)
        .where(and(eq(personas.id, body.buyerPersonaId), eq(personas.businessId, m.businessId)))
        .limit(1)
      if (!persona) return reply.code(400).send({ error: 'invalid_persona' })
    }
    const [row] = await db
      .update(customers)
      .set({
        ...(body.buyerPersonaId !== undefined ? { buyerPersonaId: body.buyerPersonaId } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(customers.id, id), eq(customers.businessId, m.businessId)))
      .returning()
    await addEvent(id, 'updated', 'Statistik aktualisiert', user.id, { patch: body })
    return {
      customer: toCustomer(row!),
      stats: await loadCustomerStats(m.businessId, row!),
    }
  })

  app.post('/api/b/:slug/customers/:id/purchases', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadCustomer(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    const body = CustomerPurchaseSchema.parse(req.body)
    let label = body.label.trim()
    let productId = body.productId ?? null
    if (productId) {
      const [product] = await db
        .select({ id: products.id, name: products.name, currency: products.currency })
        .from(products)
        .where(and(eq(products.id, productId), eq(products.businessId, m.businessId)))
        .limit(1)
      if (!product) return reply.code(400).send({ error: 'invalid_product' })
      if (!label) label = product.name
      productId = product.id
    }
    if (!label) return reply.code(400).send({ error: 'invalid_label' })
    const purchasedAt = body.purchasedAt ? new Date(body.purchasedAt) : new Date()
    if (Number.isNaN(purchasedAt.getTime())) return reply.code(400).send({ error: 'invalid_date' })
    const [purchase] = await db
      .insert(customerPurchases)
      .values({
        businessId: m.businessId,
        customerId: id,
        productId,
        label,
        amountCents: body.amountCents,
        currency: (body.currency || 'EUR').toUpperCase(),
        purchasedAt,
      })
      .returning()
    const amountLabel = new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: (body.currency || 'EUR').toUpperCase(),
    }).format(body.amountCents / 100)
    await addEvent(id, 'purchase', `Kauf: ${label} · ${amountLabel}`, user.id, {
      amountCents: body.amountCents,
      productId,
      label,
    })
    return reply.code(201).send({
      purchase,
      stats: await loadCustomerStats(m.businessId, existing),
    })
  })

  app.delete('/api/b/:slug/customers/:id/purchases/:purchaseId', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id, purchaseId } = req.params as { slug: string; id: string; purchaseId: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadCustomer(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    const [deleted] = await db
      .delete(customerPurchases)
      .where(
        and(
          eq(customerPurchases.id, purchaseId),
          eq(customerPurchases.customerId, id),
          eq(customerPurchases.businessId, m.businessId),
        ),
      )
      .returning({ id: customerPurchases.id })
    if (!deleted) return reply.code(404).send({ error: 'not_found' })
    await addEvent(id, 'purchase', 'Kauf gelöscht', user.id, { purchaseId })
    return { stats: await loadCustomerStats(m.businessId, existing) }
  })

  app.post('/api/b/:slug/customers/:id/consents', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadCustomer(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    const body = CustomerConsentSchema.parse(req.body)
    const now = new Date()
    const [consent] = await db
      .insert(customerConsents)
      .values({
        customerId: id,
        purpose: body.purpose,
        channel: body.channel,
        grantedAt: body.granted ? now : null,
        revokedAt: body.granted ? null : now,
        evidence: body.evidence ?? null,
      })
      .returning()
    await addEvent(
      id,
      'consent',
      body.granted ? `Einwilligung: ${body.purpose}` : `Widerruf: ${body.purpose}`,
      user.id,
      { channel: body.channel },
    )
    return reply.code(201).send({ consent })
  })

  app.post('/api/b/:slug/customers/:id/communication', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadCustomer(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    const body = CustomerCommLogSchema.parse(req.body)
    const [event] = await db
      .insert(customerEvents)
      .values({
        customerId: id,
        type: 'communication',
        summary: body.summary,
        actorUserId: user.id,
        meta: { channel: body.channel },
      })
      .returning()
    let note = null
    if (body.note?.trim()) {
      ;[note] = await db
        .insert(customerNotes)
        .values({ customerId: id, authorUserId: user.id, body: body.note.trim() })
        .returning()
    }
    return reply.code(201).send({ event, note })
  })
}
