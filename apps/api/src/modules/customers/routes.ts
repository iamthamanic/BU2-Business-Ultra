/**
 * Customers API — CRM list/detail, notes, consents, events, linked tasks.
 * Location: apps/api/src/modules/customers/routes.ts
 */
import type { FastifyInstance } from 'fastify'
import { and, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import {
  CustomerCommLogSchema,
  CustomerConsentSchema,
  CustomerNotePatchSchema,
  CustomerNoteSchema,
  CustomerPatchSchema,
  CustomerPurchaseSchema,
  CustomerSchema,
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
  projects,
  tasks,
  users,
} from '../../db/schema.js'
import { writeAudit } from '../../lib/audit.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'

function formatAddressLine(parts: {
  street?: string | null
  postalCode?: string | null
  city?: string | null
  country?: string | null
}): string | null {
  const line = [parts.street, [parts.postalCode, parts.city].filter(Boolean).join(' '), parts.country]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join(', ')
  return line || null
}

function toNote(
  row: typeof customerNotes.$inferSelect,
  authorDisplayName: string | null = null,
) {
  return {
    id: row.id,
    customerId: row.customerId,
    authorUserId: row.authorUserId,
    authorDisplayName: authorDisplayName?.trim() || null,
    parentNoteId: row.parentNoteId ?? null,
    body: row.body,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function loadNotesForCustomer(customerId: string) {
  const rows = await db
    .select({
      note: customerNotes,
      authorDisplayName: users.displayName,
    })
    .from(customerNotes)
    .leftJoin(users, eq(users.id, customerNotes.authorUserId))
    .where(eq(customerNotes.customerId, customerId))
    .orderBy(desc(customerNotes.createdAt))
  return rows.map((r) => toNote(r.note, r.authorDisplayName))
}

function composeDisplayName(opts: {
  kind?: string | null
  displayName?: string | null
  firstName?: string | null
  lastName?: string | null
}): string {
  const dn = (opts.displayName || '').trim()
  if (opts.kind === 'org' && dn) return dn
  const parts = [(opts.firstName || '').trim(), (opts.lastName || '').trim()].filter(Boolean)
  if (parts.length) return parts.join(' ')
  return dn
}

function toCustomer(
  row: typeof customers.$inferSelect,
  org?: { id: string; displayName: string } | null,
) {
  return {
    id: row.id,
    kind: row.kind,
    displayName: row.displayName,
    firstName: row.firstName ?? null,
    lastName: row.lastName ?? null,
    orgCustomerId: row.orgCustomerId ?? null,
    orgCustomer: org
      ? { id: org.id, displayName: org.displayName }
      : null,
    email: row.email,
    phone: row.phone,
    address:
      formatAddressLine({
        street: row.street,
        postalCode: row.postalCode,
        city: row.city,
        country: row.country,
      }) || row.address,
    street: row.street,
    postalCode: row.postalCode,
    city: row.city,
    country: row.country,
    billingStreet: row.billingStreet,
    billingPostalCode: row.billingPostalCode,
    billingCity: row.billingCity,
    billingCountry: row.billingCountry,
    relationStatus: row.relationStatus,
    birthDate: row.birthDate ?? null,
    photoUrl: row.photoUrl ?? null,
    buyerPersonaId: row.buyerPersonaId ?? null,
    tags: row.tags ?? [],
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function loadOrgSummary(businessId: string, orgCustomerId: string | null) {
  if (!orgCustomerId) return null
  const [org] = await db
    .select({ id: customers.id, displayName: customers.displayName, kind: customers.kind })
    .from(customers)
    .where(
      and(
        eq(customers.id, orgCustomerId),
        eq(customers.businessId, businessId),
        eq(customers.kind, 'org'),
      ),
    )
    .limit(1)
  return org ? { id: org.id, displayName: org.displayName } : null
}

function customerDayCount(since: Date): number {
  const start = new Date(since)
  start.setHours(0, 0, 0, 0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((now.getTime() - start.getTime()) / 86400000))
}

async function loadCustomerStats(
  businessId: string,
  customer: typeof customers.$inferSelect,
) {
  const purchases = await db
    .select({
      id: customerPurchases.id,
      productId: customerPurchases.productId,
      label: customerPurchases.label,
      amountCents: customerPurchases.amountCents,
      currency: customerPurchases.currency,
      purchasedAt: customerPurchases.purchasedAt,
    })
    .from(customerPurchases)
    .where(
      and(
        eq(customerPurchases.businessId, businessId),
        eq(customerPurchases.customerId, customer.id),
      ),
    )
    .orderBy(desc(customerPurchases.purchasedAt))

  const ltvCents = purchases.reduce((sum, p) => sum + (p.amountCents || 0), 0)
  const currency = purchases[0]?.currency || 'EUR'
  const productMap = new Map<string, { productId: string | null; name: string; amountCents: number }>()
  for (const p of purchases) {
    const key = p.productId || p.label
    const prev = productMap.get(key)
    if (prev) prev.amountCents += p.amountCents
    else productMap.set(key, { productId: p.productId, name: p.label, amountCents: p.amountCents })
  }

  let persona: { id: string; name: string; summary: string | null } | null = null
  if (customer.buyerPersonaId) {
    const [row] = await db
      .select({
        id: personas.id,
        name: personas.name,
        summary: personas.summary,
      })
      .from(personas)
      .where(and(eq(personas.id, customer.buyerPersonaId), eq(personas.businessId, businessId)))
      .limit(1)
    if (row) persona = row
  }

  const since = customer.createdAt
  return {
    ltvCents,
    currency,
    customerSince: since,
    customerDays: customerDayCount(since),
    purchaseCount: purchases.length,
    persona,
    products: [...productMap.values()],
    purchases,
  }
}

async function loadCustomer(businessId: string, id: string) {
  const rows = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.businessId, businessId)))
    .limit(1)
  return rows[0] ?? null
}

async function addEvent(
  customerId: string,
  type: string,
  summary: string,
  actorUserId: string | null,
  meta: Record<string, unknown> = {},
) {
  await db.insert(customerEvents).values({
    customerId,
    type,
    summary,
    actorUserId,
    meta,
  })
}

export async function customerRoutes(app: FastifyInstance) {
  app.get('/api/b/:slug/customers', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const q = (req.query as {
      archive?: string
      status?: string
      q?: string
      tag?: string
    }) || {}
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const archived = q.archive === '1' || q.archive === 'true'
    const conds = [
      eq(customers.businessId, m.businessId),
      archived ? isNotNull(customers.archivedAt) : isNull(customers.archivedAt),
    ]
    if (q.status && ['lead', 'prospect', 'customer'].includes(q.status)) {
      conds.push(eq(customers.relationStatus, q.status))
    }
    if (q.q?.trim()) {
      const term = `%${q.q.trim()}%`
      conds.push(
        or(
          ilike(customers.displayName, term),
          ilike(customers.email, term),
          ilike(customers.phone, term),
        )!,
      )
    }
    if (q.tag?.trim()) {
      conds.push(sql`${customers.tags} @> ${JSON.stringify([q.tag.trim()])}::jsonb`)
    }
    const rows = await db
      .select()
      .from(customers)
      .where(and(...conds))
      .orderBy(desc(customers.updatedAt))
    const orgIds = [
      ...new Set(rows.map((r) => r.orgCustomerId).filter((x): x is string => Boolean(x))),
    ]
    const orgMap = new Map<string, { id: string; displayName: string }>()
    if (orgIds.length) {
      const orgs = await db
        .select({ id: customers.id, displayName: customers.displayName })
        .from(customers)
        .where(
          and(
            eq(customers.businessId, m.businessId),
            eq(customers.kind, 'org'),
            inArray(customers.id, orgIds),
          ),
        )
      for (const o of orgs) orgMap.set(o.id, o)
    }
    return {
      customers: rows.map((r) =>
        toCustomer(r, r.orgCustomerId ? orgMap.get(r.orgCustomerId) ?? null : null),
      ),
    }
  })

  app.get('/api/b/:slug/customers/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const row = await loadCustomer(m.businessId, id)
    if (!row) return reply.code(404).send({ error: 'not_found' })
    const [notes, consents, events, stats, org] = await Promise.all([
      loadNotesForCustomer(id),
      db
        .select()
        .from(customerConsents)
        .where(eq(customerConsents.customerId, id))
        .orderBy(desc(customerConsents.createdAt)),
      db
        .select({
          id: customerEvents.id,
          type: customerEvents.type,
          summary: customerEvents.summary,
          actorUserId: customerEvents.actorUserId,
          meta: customerEvents.meta,
          createdAt: customerEvents.createdAt,
          actorDisplayName: users.displayName,
          actorEmail: users.email,
        })
        .from(customerEvents)
        .leftJoin(users, eq(users.id, customerEvents.actorUserId))
        .where(eq(customerEvents.customerId, id))
        .orderBy(desc(customerEvents.createdAt))
        .limit(100),
      loadCustomerStats(m.businessId, row),
      loadOrgSummary(m.businessId, row.orgCustomerId ?? null),
    ])
    const linkedTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.businessId, m.businessId),
          eq(tasks.customerId, id),
          isNull(tasks.archivedAt),
        ),
      )
      .orderBy(desc(tasks.updatedAt))
    const projectIds = [
      ...new Set(linkedTasks.map((t) => t.projectId).filter(Boolean) as string[]),
    ]
    const linkedProjects =
      projectIds.length === 0
        ? []
        : await db
            .select()
            .from(projects)
            .where(
              and(eq(projects.businessId, m.businessId), inArray(projects.id, projectIds)),
            )
    return {
      customer: toCustomer(row, org),
      notes,
      consents,
      events: events.map((ev) => ({
        id: ev.id,
        type: ev.type,
        summary: ev.summary,
        actorUserId: ev.actorUserId,
        actorDisplayName: ev.actorDisplayName?.trim() || ev.actorEmail || null,
        meta: (ev.meta || {}) as Record<string, unknown>,
        createdAt: ev.createdAt,
      })),
      linkedTasks,
      linkedProjects,
      stats,
      channels: {
        email: { connected: false },
        whatsapp: { connected: false },
        phone: { connected: false },
      },
    }
  })

  app.post('/api/b/:slug/customers', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const body = CustomerSchema.parse(req.body)
    const street = body.street ?? null
    const postalCode = body.postalCode ?? null
    const city = body.city ?? null
    const country = body.country ?? null
    const firstName = body.firstName?.trim() || null
    const lastName = body.lastName?.trim() || null
    const displayName = composeDisplayName({
      kind: body.kind,
      displayName: body.displayName,
      firstName,
      lastName,
    })
    if (!displayName) return reply.code(400).send({ error: 'invalid_name' })
    let orgCustomerId: string | null = body.orgCustomerId ?? null
    if (orgCustomerId) {
      if (body.kind === 'org') return reply.code(400).send({ error: 'org_cannot_link_org' })
      const org = await loadOrgSummary(m.businessId, orgCustomerId)
      if (!org) return reply.code(400).send({ error: 'invalid_org' })
      orgCustomerId = org.id
    }
    const [row] = await db
      .insert(customers)
      .values({
        businessId: m.businessId,
        kind: body.kind,
        displayName,
        firstName: body.kind === 'person' ? firstName : null,
        lastName: body.kind === 'person' ? lastName : null,
        orgCustomerId: body.kind === 'person' ? orgCustomerId : null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        street,
        postalCode,
        city,
        country,
        billingStreet: body.billingStreet ?? null,
        billingPostalCode: body.billingPostalCode ?? null,
        billingCity: body.billingCity ?? null,
        billingCountry: body.billingCountry ?? null,
        address:
          body.address ??
          formatAddressLine({ street, postalCode, city, country }),
        relationStatus: body.relationStatus,
        birthDate: body.birthDate ?? null,
        photoUrl: body.photoUrl ?? null,
        tags: body.tags,
      })
      .returning()
    await addEvent(row!.id, 'created', `Kunde angelegt: ${row!.displayName}`, user.id)
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'customer.create',
      resourceRef: `customer:${row!.id}`,
    })
    const org = await loadOrgSummary(m.businessId, row!.orgCustomerId ?? null)
    return reply.code(201).send({ customer: toCustomer(row!, org) })
  })

  app.patch('/api/b/:slug/customers/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadCustomer(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    const body = CustomerPatchSchema.parse(req.body)
    if (body.buyerPersonaId) {
      const [persona] = await db
        .select({ id: personas.id })
        .from(personas)
        .where(and(eq(personas.id, body.buyerPersonaId), eq(personas.businessId, m.businessId)))
        .limit(1)
      if (!persona) return reply.code(400).send({ error: 'invalid_persona' })
    }
    const nextKind = body.kind !== undefined ? body.kind : existing.kind
    let nextOrgId =
      body.orgCustomerId !== undefined ? body.orgCustomerId : existing.orgCustomerId
    if (nextKind === 'org') nextOrgId = null
    if (nextOrgId) {
      if (nextOrgId === id) return reply.code(400).send({ error: 'invalid_org' })
      const org = await loadOrgSummary(m.businessId, nextOrgId)
      if (!org) return reply.code(400).send({ error: 'invalid_org' })
      nextOrgId = org.id
    }
    const nextFirst =
      body.firstName !== undefined ? body.firstName?.trim() || null : existing.firstName
    const nextLast =
      body.lastName !== undefined ? body.lastName?.trim() || null : existing.lastName
    const nameTouched =
      body.displayName !== undefined ||
      body.firstName !== undefined ||
      body.lastName !== undefined ||
      body.kind !== undefined
    const nextDisplayName = nameTouched
      ? composeDisplayName({
          kind: nextKind,
          displayName:
            body.displayName !== undefined ? body.displayName : existing.displayName,
          firstName: nextKind === 'person' ? nextFirst : null,
          lastName: nextKind === 'person' ? nextLast : null,
        })
      : existing.displayName
    if (nameTouched && !nextDisplayName) return reply.code(400).send({ error: 'invalid_name' })

    const nextStreet = body.street !== undefined ? body.street : existing.street
    const nextPostal = body.postalCode !== undefined ? body.postalCode : existing.postalCode
    const nextCity = body.city !== undefined ? body.city : existing.city
    const nextCountry = body.country !== undefined ? body.country : existing.country
    const structuredTouched =
      body.street !== undefined ||
      body.postalCode !== undefined ||
      body.city !== undefined ||
      body.country !== undefined
    const [row] = await db
      .update(customers)
      .set({
        ...(body.kind !== undefined ? { kind: body.kind } : {}),
        ...(nameTouched ? { displayName: nextDisplayName } : {}),
        ...(body.firstName !== undefined || body.kind !== undefined
          ? { firstName: nextKind === 'person' ? nextFirst : null }
          : {}),
        ...(body.lastName !== undefined || body.kind !== undefined
          ? { lastName: nextKind === 'person' ? nextLast : null }
          : {}),
        ...(body.orgCustomerId !== undefined || body.kind !== undefined
          ? { orgCustomerId: nextKind === 'person' ? nextOrgId : null }
          : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.street !== undefined ? { street: body.street } : {}),
        ...(body.postalCode !== undefined ? { postalCode: body.postalCode } : {}),
        ...(body.city !== undefined ? { city: body.city } : {}),
        ...(body.country !== undefined ? { country: body.country } : {}),
        ...(body.billingStreet !== undefined ? { billingStreet: body.billingStreet } : {}),
        ...(body.billingPostalCode !== undefined
          ? { billingPostalCode: body.billingPostalCode }
          : {}),
        ...(body.billingCity !== undefined ? { billingCity: body.billingCity } : {}),
        ...(body.billingCountry !== undefined ? { billingCountry: body.billingCountry } : {}),
        ...(body.address !== undefined
          ? { address: body.address }
          : structuredTouched
            ? {
                address: formatAddressLine({
                  street: nextStreet,
                  postalCode: nextPostal,
                  city: nextCity,
                  country: nextCountry,
                }),
              }
            : {}),
        ...(body.relationStatus !== undefined ? { relationStatus: body.relationStatus } : {}),
        ...(body.birthDate !== undefined ? { birthDate: body.birthDate } : {}),
        ...(body.photoUrl !== undefined ? { photoUrl: body.photoUrl } : {}),
        ...(body.buyerPersonaId !== undefined ? { buyerPersonaId: body.buyerPersonaId } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(customers.id, id), eq(customers.businessId, m.businessId)))
      .returning()
    await addEvent(id, 'updated', 'Profil aktualisiert', user.id, { patch: body })
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'customer.update',
      resourceRef: `customer:${id}`,
    })
    const org = await loadOrgSummary(m.businessId, row!.orgCustomerId ?? null)
    return { customer: toCustomer(row!, org) }
  })

  app.post('/api/b/:slug/customers/:id/archive', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadCustomer(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    const [row] = await db
      .update(customers)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(customers.id, id), eq(customers.businessId, m.businessId)))
      .returning()
    await addEvent(id, 'archived', 'Kunde archiviert', user.id)
    return { customer: toCustomer(row!) }
  })

  app.post('/api/b/:slug/customers/:id/restore', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadCustomer(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    const [row] = await db
      .update(customers)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(and(eq(customers.id, id), eq(customers.businessId, m.businessId)))
      .returning()
    await addEvent(id, 'restored', 'Kunde wiederhergestellt', user.id)
    return { customer: toCustomer(row!) }
  })

  app.post('/api/b/:slug/customers/:id/notes', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadCustomer(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    const body = CustomerNoteSchema.parse(req.body)
    let parentNoteId: string | null = body.parentNoteId ?? null
    if (parentNoteId) {
      const [parent] = await db
        .select()
        .from(customerNotes)
        .where(and(eq(customerNotes.id, parentNoteId), eq(customerNotes.customerId, id)))
        .limit(1)
      if (!parent) return reply.code(400).send({ error: 'invalid_parent' })
      // One-level threads: replies always hang off the root note
      parentNoteId = parent.parentNoteId ?? parent.id
    }
    const [note] = await db
      .insert(customerNotes)
      .values({
        customerId: id,
        authorUserId: user.id,
        parentNoteId,
        body: body.body,
      })
      .returning()
    await addEvent(
      id,
      'note',
      parentNoteId ? 'Notiz-Antwort hinzugefügt' : 'Notiz hinzugefügt',
      user.id,
    )
    return reply.code(201).send({
      note: toNote(note!, user.displayName ?? null),
    })
  })

  app.patch('/api/b/:slug/customers/:id/notes/:noteId', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id, noteId } = req.params as { slug: string; id: string; noteId: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadCustomer(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    const body = CustomerNotePatchSchema.parse(req.body)
    if (!body.body?.trim()) return reply.code(400).send({ error: 'invalid_body' })
    const [note] = await db
      .update(customerNotes)
      .set({ body: body.body.trim(), updatedAt: new Date() })
      .where(and(eq(customerNotes.id, noteId), eq(customerNotes.customerId, id)))
      .returning()
    if (!note) return reply.code(404).send({ error: 'not_found' })
    let authorDisplayName: string | null = user.displayName ?? null
    if (note.authorUserId && note.authorUserId !== user.id) {
      const [author] = await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, note.authorUserId))
        .limit(1)
      authorDisplayName = author?.displayName ?? null
    }
    await addEvent(id, 'note', 'Notiz bearbeitet', user.id)
    return { note: toNote(note, authorDisplayName) }
  })

  app.delete('/api/b/:slug/customers/:id/notes/:noteId', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id, noteId } = req.params as { slug: string; id: string; noteId: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
    const existing = await loadCustomer(m.businessId, id)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    const [deleted] = await db
      .delete(customerNotes)
      .where(and(eq(customerNotes.id, noteId), eq(customerNotes.customerId, id)))
      .returning({ id: customerNotes.id })
    if (!deleted) return reply.code(404).send({ error: 'not_found' })
    await addEvent(id, 'note', 'Notiz gelöscht', user.id)
    return reply.code(204).send()
  })

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
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
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
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
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
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
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
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
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
    if (!m || !canMutateContent(m.role)) return reply.code(403).send({ error: 'forbidden' })
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
