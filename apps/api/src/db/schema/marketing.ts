/**
 * Drizzle schema — marketing ownership tables.
 * Location: apps/api/src/db/schema/marketing.ts
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
import { businessIntegrations } from './integrations.js'

export const catalogProducts = pgTable('catalog_products', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  sku: varchar('sku', { length: 80 }),
  description: text('description'),
  currency: varchar('currency', { length: 3 }).notNull().default('EUR'),
  netPriceCents: integer('net_price_cents').notNull().default(0),
  taxRateBps: integer('tax_rate_bps').notNull().default(1900),
  active: boolean('active').notNull().default(true),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const socialDrafts = pgTable('social_drafts', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  masterText: text('master_text').notNull().default(''),
  variants: jsonb('variants').$type<unknown[]>().notNull().default([]),
  remoteStatus: jsonb('remote_status').$type<Record<string, unknown>>().default({}),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const adsCampaigns = pgTable('ads_campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 40 }).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  budgetDailyCents: integer('budget_daily_cents'),
  objective: varchar('objective', { length: 120 }),
  payload: jsonb('payload').$type<Record<string, unknown>>().default({}),
  remoteId: varchar('remote_id', { length: 120 }),
  status: varchar('status', { length: 40 }).notNull().default('draft'),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const brevoCampaigns = pgTable('brevo_campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  subject: varchar('subject', { length: 300 }),
  htmlContent: text('html_content'),
  status: varchar('status', { length: 40 }).notNull().default('draft'),
  remoteId: varchar('remote_id', { length: 120 }),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Linked provider brands / projects (e.g. Metricool blogId). */
export const funnelBindings = pgTable(
  'funnel_bindings',
  {
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    surface: varchar('surface', { length: 80 }).notNull(),
    provider: varchar('provider', { length: 40 }).notNull().default('metricool'),
    integrationId: uuid('integration_id').references(() => businessIntegrations.id, {
      onDelete: 'set null',
    }),
    status: varchar('status', { length: 24 }).notNull().default('active'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.surface] })],
)

/**
 * Integration Core — multi-account connections (not settings_secrets).
 * One row = one connected mailbox/page/bot under a business.
 */
