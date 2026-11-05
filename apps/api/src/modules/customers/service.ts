/**
 * Customers domain service — mappers, loaders, events, stats.
 * Location: apps/api/src/modules/customers/service.ts
 */
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import {
  customerEvents,
  customerNotes,
  customerPurchases,
  customers,
  personas,
  users,
} from '../../db/schema.js'

export function formatAddressLine(parts: {
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

export function toNote(
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

export async function loadNotesForCustomer(customerId: string) {
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

export function composeDisplayName(opts: {
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

export function toCustomer(
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

export async function loadOrgSummary(businessId: string, orgCustomerId: string | null) {
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

export function customerDayCount(since: Date): number {
  const start = new Date(since)
  start.setHours(0, 0, 0, 0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((now.getTime() - start.getTime()) / 86400000))
}

export async function loadCustomerStats(
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

export async function loadCustomer(businessId: string, id: string) {
  const rows = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.businessId, businessId)))
    .limit(1)
  return rows[0] ?? null
}

export async function addEvent(
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
