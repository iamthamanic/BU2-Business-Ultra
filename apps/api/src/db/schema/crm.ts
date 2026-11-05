/**
 * Drizzle schema — crm ownership tables.
 * Location: apps/api/src/db/schema/crm.ts
 */
import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { businesses, users } from './identity.js'
import { personas } from './tools.js'

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description').notNull().default(''),
  market: varchar('market', { length: 8 }).notNull().default('b2b'),
  coverPath: text('cover_path'),
  currency: varchar('currency', { length: 3 }).notNull().default('EUR'),
  sellingPriceCents: integer('selling_price_cents').notNull().default(0),
  priceKind: varchar('price_kind', { length: 8 }).notNull().default('gross'),
  taxRateBps: integer('tax_rate_bps').notNull().default(1900),
  costPositions: jsonb('cost_positions').$type<unknown[]>().notNull().default([]),
  personaIds: jsonb('persona_ids').$type<string[]>().notNull().default([]),
  personaDraft: jsonb('persona_draft').$type<Record<string, unknown>>().notNull().default({}),
  journeyCanvas: jsonb('journey_canvas')
    .$type<{ nodes: unknown[]; edges: unknown[] }>()
    .notNull()
    .default({ nodes: [], edges: [] }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** CRM customers (person/org) — soft-archive. */
export const customers = pgTable(
  'customers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    /** Per-business sequential number, starts at 100100 (always 6+ digits). */
    customerNumber: integer('customer_number').notNull(),
    kind: varchar('kind', { length: 16 }).notNull().default('person'),
    displayName: varchar('display_name', { length: 200 }).notNull(),
    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),
    orgCustomerId: uuid('org_customer_id'),
    email: varchar('email', { length: 320 }),
    phone: varchar('phone', { length: 64 }),
    address: text('address'),
    street: varchar('street', { length: 200 }),
    postalCode: varchar('postal_code', { length: 32 }),
    city: varchar('city', { length: 120 }),
    country: varchar('country', { length: 120 }),
    billingStreet: varchar('billing_street', { length: 200 }),
    billingPostalCode: varchar('billing_postal_code', { length: 32 }),
    billingCity: varchar('billing_city', { length: 120 }),
    billingCountry: varchar('billing_country', { length: 120 }),
    relationStatus: varchar('relation_status', { length: 24 }).notNull().default('lead'),
    birthDate: date('birth_date'),
    photoUrl: text('photo_url'),
    buyerPersonaId: uuid('buyer_persona_id').references(() => personas.id, { onDelete: 'set null' }),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('customers_biz_number_uidx').on(t.businessId, t.customerNumber)],
)

/** Company label catalog by scope (customer/project/marketing/product). */
export const businessTags = pgTable(
  'business_tags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    /** customer | project | marketing | product */
    scope: varchar('scope', { length: 24 }).notNull().default('customer'),
    name: varchar('name', { length: 40 }).notNull(),
    color: varchar('color', { length: 16 }),
    description: text('description').notNull().default(''),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('business_tags_biz_scope_name_uidx').on(t.businessId, t.scope, t.name)],
)

/** CRM purchase lines — SoR for customer LTV / product mix (no full order system yet). */
export const customerPurchases = pgTable('customer_purchases', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  label: varchar('label', { length: 200 }).notNull(),
  amountCents: integer('amount_cents').notNull().default(0),
  currency: varchar('currency', { length: 3 }).notNull().default('EUR'),
  purchasedAt: timestamp('purchased_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const customerNotes = pgTable('customer_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  authorUserId: uuid('author_user_id').references(() => users.id, { onDelete: 'set null' }),
  parentNoteId: uuid('parent_note_id'),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const customerConsents = pgTable('customer_consents', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  purpose: varchar('purpose', { length: 120 }).notNull(),
  channel: varchar('channel', { length: 40 }).notNull().default('email'),
  grantedAt: timestamp('granted_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  evidence: text('evidence'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const customerEvents = pgTable('customer_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 64 }).notNull(),
  summary: text('summary').notNull().default(''),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Projects: area (container) or custom (completable). */
