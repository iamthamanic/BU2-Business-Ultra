/**
 * Orders API — product order templates + concrete orders.
 * Location: apps/api/src/modules/orders/routes.ts
 */
import type { FastifyInstance } from 'fastify'
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import {
  OrderCreateSchema,
  OrderPatchSchema,
  OrderStatusSchema,
  OrderTemplatePutSchema,
  hasPermission,
  isOrderTemplateReady,
} from '@bu2/shared'
import { db } from '../../db/client.js'
import { contacts, productOrderTemplates, productOrders, products } from '../../db/schema.js'
import { writeAudit } from '../../lib/audit.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import { calcSummary } from '../products/service.js'
import {
  allocateOrderNumber,
  normalizeBlocks,
  toOrderClient,
  toTemplateClient,
  toTemplateSnapshot,
} from './service.js'

export async function orderRoutes(app: FastifyInstance) {
  app.get('/api/b/:slug/products/:productId/order-template', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, productId } = req.params as { slug: string; productId: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'products.read')) return reply.code(403).send({ error: 'forbidden' })

    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, productId), eq(products.businessId, m.businessId)))
      .limit(1)
    if (!product) return reply.code(404).send({ error: 'not_found' })

    const [row] = await db
      .select()
      .from(productOrderTemplates)
      .where(
        and(
          eq(productOrderTemplates.businessId, m.businessId),
          eq(productOrderTemplates.productId, productId),
        ),
      )
      .limit(1)

    if (!row) {
      return {
        template: {
          id: null,
          productId,
          title: '',
          blocks: [],
          ready: false,
          createdAt: null,
          updatedAt: null,
        },
      }
    }
    return { template: toTemplateClient(row) }
  })

  app.put('/api/b/:slug/products/:productId/order-template', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, productId } = req.params as { slug: string; productId: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'products.write')) return reply.code(403).send({ error: 'forbidden' })
    if (m.status === 'archived') return reply.code(409).send({ error: 'business_archived' })

    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, productId), eq(products.businessId, m.businessId)))
      .limit(1)
    if (!product) return reply.code(404).send({ error: 'not_found' })

    const body = OrderTemplatePutSchema.parse(req.body)
    const blocks = normalizeBlocks(body.blocks)
    const title = body.title.trim()
    const now = new Date()

    const [existing] = await db
      .select({ id: productOrderTemplates.id })
      .from(productOrderTemplates)
      .where(
        and(
          eq(productOrderTemplates.businessId, m.businessId),
          eq(productOrderTemplates.productId, productId),
        ),
      )
      .limit(1)

    let row
    if (existing) {
      ;[row] = await db
        .update(productOrderTemplates)
        .set({ title, blocks, updatedAt: now })
        .where(eq(productOrderTemplates.id, existing.id))
        .returning()
    } else {
      ;[row] = await db
        .insert(productOrderTemplates)
        .values({
          businessId: m.businessId,
          productId,
          title,
          blocks,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
    }

    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'order_template.upsert',
      resourceRef: `product_order_template:${row!.id}`,
      meta: { productId, ready: isOrderTemplateReady({ title, blocks }) },
    })

    return { template: toTemplateClient(row!) }
  })

  app.get('/api/b/:slug/orders', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const q = (req.query as { status?: string; q?: string }) || {}
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'products.read')) return reply.code(403).send({ error: 'forbidden' })

    const filters = [eq(productOrders.businessId, m.businessId)]
    if (q.status) {
      const st = OrderStatusSchema.safeParse(q.status)
      if (st.success) filters.push(eq(productOrders.status, st.data))
    }
    const term = (q.q || '').trim()
    if (term) {
      const like = `%${term}%`
      filters.push(
        or(
          ilike(productOrders.title, like),
          sql`cast(${productOrders.orderNumber} as text) ilike ${like}`,
        )!,
      )
    }

    const rows = await db
      .select({
        order: productOrders,
        customerName: contacts.displayName,
        productName: products.name,
      })
      .from(productOrders)
      .leftJoin(contacts, eq(contacts.id, productOrders.customerId))
      .leftJoin(products, eq(products.id, productOrders.productId))
      .where(and(...filters))
      .orderBy(desc(productOrders.createdAt))

    return {
      orders: rows.map((r) =>
        toOrderClient(r.order, {
          customerName: r.customerName,
          productName: r.productName,
        }),
      ),
    }
  })

  app.post('/api/b/:slug/orders', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'products.write')) return reply.code(403).send({ error: 'forbidden' })
    if (m.status === 'archived') return reply.code(409).send({ error: 'business_archived' })

    const body = OrderCreateSchema.parse(req.body)

    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, body.productId), eq(products.businessId, m.businessId)))
      .limit(1)
    if (!product || product.archivedAt) return reply.code(404).send({ error: 'product_not_found' })

    const [customer] = await db
      .select({
        id: contacts.id,
        displayName: contacts.displayName,
        isCustomer: contacts.isCustomer,
      })
      .from(contacts)
      .where(and(eq(contacts.id, body.customerId), eq(contacts.businessId, m.businessId)))
      .limit(1)
    if (!customer || !customer.isCustomer) {
      return reply.code(400).send({ error: 'customer_required' })
    }

    const [template] = await db
      .select()
      .from(productOrderTemplates)
      .where(
        and(
          eq(productOrderTemplates.businessId, m.businessId),
          eq(productOrderTemplates.productId, body.productId),
        ),
      )
      .limit(1)

    const blocks = normalizeBlocks(template?.blocks)
    const templateTitle = (template?.title || '').trim()
    if (!template || !isOrderTemplateReady({ title: templateTitle, blocks })) {
      return reply.code(400).send({ error: 'template_not_ready' })
    }

    const snapshot = toTemplateSnapshot(templateTitle, blocks)
    const calc = calcSummary(product)
    const amountCents =
      body.amountCents != null ? body.amountCents : Math.max(0, calc.netRevenueCents)
    const title = (body.title || product.name || templateTitle).trim().slice(0, 200)
    const orderNumber = await allocateOrderNumber(m.businessId)
    const now = new Date()

    const [row] = await db
      .insert(productOrders)
      .values({
        businessId: m.businessId,
        orderNumber,
        productId: body.productId,
        customerId: body.customerId,
        status: 'draft',
        title,
        amountCents,
        currency: product.currency || 'EUR',
        notes: body.notes ?? null,
        snapshot,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'order.create',
      resourceRef: `product_order:${row!.id}`,
      meta: { orderNumber, productId: body.productId, customerId: body.customerId },
    })

    return reply.code(201).send({
      order: toOrderClient(row!, {
        customerName: customer.displayName,
        productName: product.name,
      }),
    })
  })

  app.patch('/api/b/:slug/orders/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'products.write')) return reply.code(403).send({ error: 'forbidden' })
    if (m.status === 'archived') return reply.code(409).send({ error: 'business_archived' })

    const body = OrderPatchSchema.parse(req.body)
    const [existing] = await db
      .select()
      .from(productOrders)
      .where(and(eq(productOrders.id, id), eq(productOrders.businessId, m.businessId)))
      .limit(1)
    if (!existing) return reply.code(404).send({ error: 'not_found' })

    const patch: Partial<typeof productOrders.$inferInsert> = { updatedAt: new Date() }
    if (body.status != null) patch.status = body.status
    if (body.title != null) patch.title = body.title.trim()
    if (body.amountCents != null) patch.amountCents = body.amountCents
    if (body.notes !== undefined) patch.notes = body.notes

    const [row] = await db
      .update(productOrders)
      .set(patch)
      .where(eq(productOrders.id, id))
      .returning()

    const [joined] = await db
      .select({
        customerName: contacts.displayName,
        productName: products.name,
      })
      .from(productOrders)
      .leftJoin(contacts, eq(contacts.id, productOrders.customerId))
      .leftJoin(products, eq(products.id, productOrders.productId))
      .where(eq(productOrders.id, id))
      .limit(1)

    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'order.patch',
      resourceRef: `product_order:${id}`,
      meta: body,
    })

    return {
      order: toOrderClient(row!, {
        customerName: joined?.customerName,
        productName: joined?.productName,
      }),
    }
  })
}
