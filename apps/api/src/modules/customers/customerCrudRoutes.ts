/**
 * Customer CRUD HTTP — list/detail/create/patch/archive/restore.
 * Location: apps/api/src/modules/customers/customerCrudRoutes.ts
 */
import type { FastifyInstance } from 'fastify'
import { and, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { CustomerPatchSchema, CustomerSchema, canMutateContent } from '@bu2/shared'
import { db } from '../../db/client.js'
import {
  customerConsents,
  customerEvents,
  customers,
  personas,
  projects,
  tasks,
  users,
} from '../../db/schema.js'
import { writeAudit } from '../../lib/audit.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import {
  addEvent,
  allocateCustomerNumber,
  composeDisplayName,
  formatAddressLine,
  loadCustomer,
  loadCustomerStats,
  loadNotesForCustomer,
  loadOrgSummary,
  toCustomer,
} from './service.js'

export async function registerCustomerCrudRoutes(app: FastifyInstance) {
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
    const customerNumber = await allocateCustomerNumber(m.businessId)
    const [row] = await db
      .insert(customers)
      .values({
        businessId: m.businessId,
        customerNumber,
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
}
