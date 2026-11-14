/**
 * Company label catalog — CRUD under /api/b/:slug/labels (scopes: customer/project/marketing/product).
 * Location: apps/api/src/modules/tags/routes.ts
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { and, asc, eq, sql } from 'drizzle-orm'
import {
  BusinessLabelPatchSchema,
  BusinessLabelSchema,
  BusinessLabelScopeSchema,
  hasPermission,
  type BusinessLabelScope,
} from '@bu2/shared'
import { db } from '../../db/client.js'
import { businessTags, customers, users } from '../../db/schema.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

function parseScope(raw: unknown): BusinessLabelScope {
  const parsed = BusinessLabelScopeSchema.safeParse(raw || 'customer')
  return parsed.success ? parsed.data : 'customer'
}

function toLabel(
  row: typeof businessTags.$inferSelect,
  createdByDisplayName: string | null = null,
) {
  return {
    id: row.id,
    businessId: row.businessId,
    scope: row.scope,
    name: row.name,
    color: row.color,
    description: row.description || '',
    createdByUserId: row.createdByUserId,
    createdByDisplayName: createdByDisplayName?.trim() || null,
    createdAt: row.createdAt,
  }
}

async function findByName(businessId: string, scope: BusinessLabelScope, name: string) {
  const needle = name.toLowerCase()
  const rows = await db
    .select()
    .from(businessTags)
    .where(and(eq(businessTags.businessId, businessId), eq(businessTags.scope, scope)))
  return rows.find((r) => r.name.toLowerCase() === needle) ?? null
}

async function rewriteCustomerLabels(
  businessId: string,
  fromName: string,
  toName: string | null,
) {
  const rows = await db
    .select({ id: customers.id, tags: customers.tags })
    .from(customers)
    .where(
      and(
        eq(customers.businessId, businessId),
        sql`${customers.tags} @> ${JSON.stringify([fromName])}::jsonb`,
      ),
    )
  for (const row of rows) {
    const next = (row.tags || [])
      .map((t) => (t === fromName ? toName : t))
      .filter((t): t is string => Boolean(t))
    const deduped = [...new Set(next)]
    await db
      .update(customers)
      .set({ tags: deduped, updatedAt: new Date() })
      .where(eq(customers.id, row.id))
  }
}

export async function tagsRoutes(app: FastifyInstance) {
  async function listLabels(req: FastifyRequest, reply: FastifyReply) {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'customers.read')) return reply.code(403).send({ error: 'forbidden' })
    const q = (req.query as { scope?: string }) || {}
    const scope = q.scope ? parseScope(q.scope) : null
    const rows = await db
      .select({
        label: businessTags,
        createdByDisplayName: users.displayName,
      })
      .from(businessTags)
      .leftJoin(users, eq(users.id, businessTags.createdByUserId))
      .where(
        scope
          ? and(eq(businessTags.businessId, m.businessId), eq(businessTags.scope, scope))
          : eq(businessTags.businessId, m.businessId),
      )
      .orderBy(asc(businessTags.scope), asc(businessTags.name))
    const labels = rows.map((r) => toLabel(r.label, r.createdByDisplayName))
    return { labels, tags: labels }
  }

  async function createLabel(req: FastifyRequest, reply: FastifyReply) {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'customers.write')) return reply.code(403).send({ error: 'forbidden' })
    const body = BusinessLabelSchema.parse(req.body)
    const scope = body.scope
    const name = normalizeName(body.name)
    if (!name) return reply.code(400).send({ error: 'invalid_name' })
    const description = (body.description || '').trim()
    const existing = await findByName(m.businessId, scope, name)
    if (existing) return reply.code(409).send({ error: 'label_exists', label: toLabel(existing) })
    const [row] = await db
      .insert(businessTags)
      .values({
        businessId: m.businessId,
        scope,
        name,
        color: body.color ?? null,
        description,
        createdByUserId: user.id,
      })
      .returning()
    const label = toLabel(row!, user.displayName ?? null)
    return reply.code(201).send({ label, tag: label })
  }

  async function patchLabel(req: FastifyRequest, reply: FastifyReply) {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'customers.write')) return reply.code(403).send({ error: 'forbidden' })
    const body = BusinessLabelPatchSchema.parse(req.body)
    const [existing] = await db
      .select()
      .from(businessTags)
      .where(and(eq(businessTags.id, id), eq(businessTags.businessId, m.businessId)))
      .limit(1)
    if (!existing) return reply.code(404).send({ error: 'not_found' })

    const scope = parseScope(existing.scope)
    let nextName = existing.name
    if (body.name !== undefined) {
      nextName = normalizeName(body.name)
      if (!nextName) return reply.code(400).send({ error: 'invalid_name' })
      if (nextName.toLowerCase() !== existing.name.toLowerCase()) {
        const clash = await findByName(m.businessId, scope, nextName)
        if (clash) return reply.code(409).send({ error: 'label_exists', label: toLabel(clash) })
      }
    }

    const [row] = await db
      .update(businessTags)
      .set({
        ...(body.name !== undefined ? { name: nextName } : {}),
        ...(body.color !== undefined ? { color: body.color } : {}),
        ...(body.description !== undefined ? { description: body.description.trim() } : {}),
      })
      .where(and(eq(businessTags.id, id), eq(businessTags.businessId, m.businessId)))
      .returning()

    if (scope === 'customer' && nextName !== existing.name) {
      await rewriteCustomerLabels(m.businessId, existing.name, nextName)
    }

    let createdByDisplayName: string | null = user.displayName ?? null
    if (row!.createdByUserId && row!.createdByUserId !== user.id) {
      const [author] = await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, row!.createdByUserId))
        .limit(1)
      createdByDisplayName = author?.displayName ?? null
    } else if (!row!.createdByUserId) {
      createdByDisplayName = null
    }

    const label = toLabel(row!, createdByDisplayName)
    return { label, tag: label }
  }

  async function deleteLabel(req: FastifyRequest, reply: FastifyReply) {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !hasPermission(m, 'customers.write')) return reply.code(403).send({ error: 'forbidden' })
    const [existing] = await db
      .select()
      .from(businessTags)
      .where(and(eq(businessTags.id, id), eq(businessTags.businessId, m.businessId)))
      .limit(1)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    await db
      .delete(businessTags)
      .where(and(eq(businessTags.id, id), eq(businessTags.businessId, m.businessId)))
    if (parseScope(existing.scope) === 'customer') {
      await rewriteCustomerLabels(m.businessId, existing.name, null)
    }
    return reply.code(204).send()
  }

  app.get('/api/b/:slug/labels', listLabels)
  app.get('/api/b/:slug/tags', listLabels)
  app.post('/api/b/:slug/labels', createLabel)
  app.post('/api/b/:slug/tags', createLabel)
  app.patch('/api/b/:slug/labels/:id', patchLabel)
  app.patch('/api/b/:slug/tags/:id', patchLabel)
  app.delete('/api/b/:slug/labels/:id', deleteLabel)
  app.delete('/api/b/:slug/tags/:id', deleteLabel)
}
