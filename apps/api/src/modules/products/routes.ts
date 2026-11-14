/**
 * Products API — company Product SoR (description, calc, persona links, journey).
 * Location: apps/api/src/modules/products/routes.ts — helpers in ./service.ts
 */
import type { FastifyInstance } from 'fastify'
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { resolveNetRevenue } from '@bu2/finance-calc'
import { ProductPatchSchema, ProductSchema, hasPermission } from '@bu2/shared'
import { db } from '../../db/client.js'
import { products } from '../../db/schema.js'
import { writeAudit } from '../../lib/audit.js'
import { loadEnv } from '../../lib/env.js'
import { randomToken } from '../../lib/crypto.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'

type CostPos = {
  id: string
  dept: string
  label: string
  amountCents: number
  enabled: boolean
  note?: string
}
import { calcSummary, toClient } from './service.js'

export async function productRoutes(app: FastifyInstance) {
  app.get('/api/b/:slug/products', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const q = (req.query as { archive?: string }) || {}
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'products.read')) return reply.code(403).send({ error: 'forbidden' })
    const archived = q.archive === '1' || q.archive === 'true'
    const rows = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.businessId, m.businessId),
          archived ? isNotNull(products.archivedAt) : isNull(products.archivedAt),
        ),
      )
      .orderBy(desc(products.updatedAt))
    return { products: rows.map(toClient) }
  })

  app.get('/api/b/:slug/products/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'products.read')) return reply.code(403).send({ error: 'forbidden' })
    const rows = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.businessId, m.businessId)))
      .limit(1)
    const row = rows[0]
    if (!row) return reply.code(404).send({ error: 'not_found' })
    return { product: toClient(row), calc: calcSummary(row) }
  })

  app.post('/api/b/:slug/products', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'products.write')) return reply.code(403).send({ error: 'forbidden' })
    if (m.status === 'archived') return reply.code(409).send({ error: 'business_archived' })
    const body = ProductSchema.parse(req.body)
    const [row] = await db
      .insert(products)
      .values({
        businessId: m.businessId,
        name: body.name,
        description: body.description,
        market: body.market,
        coverPath: body.coverPath ?? null,
        currency: body.currency,
        sellingPriceCents: body.sellingPriceCents,
        priceKind: body.priceKind,
        taxRateBps: body.taxRateBps,
        costPositions: body.costPositions,
        personaIds: body.personaIds,
        personaDraft: body.personaDraft,
        journeyCanvas: body.journeyCanvas,
      })
      .returning()
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'product.created',
      resourceRef: row!.id,
    })
    return { product: toClient(row!) }
  })

  app.patch('/api/b/:slug/products/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'products.write')) return reply.code(403).send({ error: 'forbidden' })
    const body = ProductPatchSchema.parse(req.body)
    const [row] = await db
      .update(products)
      .set({
        ...(body.name != null ? { name: body.name } : {}),
        ...(body.description != null ? { description: body.description } : {}),
        ...(body.market != null ? { market: body.market } : {}),
        ...(body.coverPath !== undefined ? { coverPath: body.coverPath } : {}),
        ...(body.currency != null ? { currency: body.currency } : {}),
        ...(body.sellingPriceCents != null ? { sellingPriceCents: body.sellingPriceCents } : {}),
        ...(body.priceKind != null ? { priceKind: body.priceKind } : {}),
        ...(body.taxRateBps != null ? { taxRateBps: body.taxRateBps } : {}),
        ...(body.costPositions != null ? { costPositions: body.costPositions } : {}),
        ...(body.personaIds != null ? { personaIds: body.personaIds } : {}),
        ...(body.personaDraft != null ? { personaDraft: body.personaDraft } : {}),
        ...(body.journeyCanvas != null ? { journeyCanvas: body.journeyCanvas } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(products.id, id), eq(products.businessId, m.businessId)))
      .returning()
    if (!row) return reply.code(404).send({ error: 'not_found' })
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'product.updated',
      resourceRef: row.id,
    })
    return { product: toClient(row), calc: calcSummary(row) }
  })

  app.post('/api/b/:slug/products/:id/archive', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'products.write')) return reply.code(403).send({ error: 'forbidden' })
    const body = z.object({ archived: z.boolean() }).parse(req.body ?? { archived: true })
    const [row] = await db
      .update(products)
      .set({
        archivedAt: body.archived ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(products.id, id), eq(products.businessId, m.businessId)))
      .returning()
    if (!row) return reply.code(404).send({ error: 'not_found' })
    return { product: toClient(row) }
  })

  app.post('/api/b/:slug/products/:id/cover', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'products.write')) return reply.code(403).send({ error: 'forbidden' })
    const body = z.object({ dataUrl: z.string().startsWith('data:image/') }).parse(req.body)
    const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/.exec(body.dataUrl)
    if (!match) return reply.code(400).send({ error: 'invalid_data_url' })
    const mime = match[1]!
    const buf = Buffer.from(match[2]!, 'base64')
    if (buf.length > 2_000_000) return reply.code(413).send({ error: 'too_large' })
    const existing = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.businessId, m.businessId)))
      .limit(1)
    if (!existing[0]) return reply.code(404).send({ error: 'not_found' })
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'
    const env = loadEnv()
    const dir = join(env.UPLOADS_DIR, m.businessId, 'products')
    await mkdir(dir, { recursive: true })
    const filename = `cover-${id.slice(0, 8)}-${randomToken(6)}.${ext}`
    await writeFile(join(dir, filename), buf)
    const publicPath = `/api/media/${m.businessId}/products/${filename}`
    const [row] = await db
      .update(products)
      .set({ coverPath: publicPath, updatedAt: new Date() })
      .where(and(eq(products.id, id), eq(products.businessId, m.businessId)))
      .returning()
    return { product: toClient(row!) }
  })

  app.post('/api/b/:slug/products/preview-calc', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'products.read')) return reply.code(403).send({ error: 'forbidden' })
    const body = z
      .object({
        sellingPriceCents: z.number().int().nonnegative(),
        priceKind: z.enum(['gross', 'net']).default('gross'),
        taxRateBps: z.number().int().min(0).max(10000).default(1900),
        currency: z.string().length(3).default('EUR'),
        costPositions: z.array(z.record(z.unknown())).default([]),
      })
      .parse(req.body)
    return {
      calc: calcSummary({
        sellingPriceCents: body.sellingPriceCents,
        priceKind: body.priceKind,
        taxRateBps: body.taxRateBps,
        currency: body.currency,
        costPositions: body.costPositions,
      }),
    }
  })
}
