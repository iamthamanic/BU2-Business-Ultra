/**
 * Drizzle schema — finance ownership (bank accounts + booked cash movements).
 * Location: apps/api/src/db/schema/finance.ts
 */
import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  date,
} from 'drizzle-orm/pg-core'

import { businesses } from './identity.js'
import { connections } from './integrations.js'
import { contacts } from './crm.js'

/** Bank / cash account belonging to a business. */
export const financeAccounts = pgTable(
  'finance_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 160 }).notNull(),
    iban: varchar('iban', { length: 34 }),
    bankName: varchar('bank_name', { length: 120 }),
    currency: varchar('currency', { length: 3 }).notNull().default('EUR'),
    /** Ledger balance in minor units (cents). */
    balanceCents: integer('balance_cents').notNull().default(0),
    /** Optional Integration Core connection (e.g. finAPI). */
    connectionId: uuid('connection_id').references(() => connections.id, {
      onDelete: 'set null',
    }),
    /** manual | finapi | demo | import */
    source: varchar('source', { length: 24 }).notNull().default('manual'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('finance_accounts_biz_iban_uidx').on(t.businessId, t.iban)],
)

/** Booked or planned cash movement on a finance account. */
export const financeTransactions = pgTable(
  'finance_transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => financeAccounts.id, { onDelete: 'cascade' }),
    bookedOn: date('booked_on').notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description').notNull().default(''),
    category: varchar('category', { length: 80 }).notNull().default('Sonstiges'),
    projectLabel: varchar('project_label', { length: 160 }),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    /** paid | overdue | planned */
    status: varchar('status', { length: 16 }).notNull().default('paid'),
    /** income | expense */
    kind: varchar('kind', { length: 16 }).notNull(),
    source: varchar('source', { length: 80 }).notNull().default('manual'),
    /** Always ≥ 0; sign comes from kind. */
    amountCents: integer('amount_cents').notNull(),
    recurring: boolean('recurring').notNull().default(false),
    /** Provider sync dedupe key when present. */
    externalId: varchar('external_id', { length: 160 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('finance_tx_biz_external_uidx').on(t.businessId, t.externalId),
  ],
)

/** Per-business finance knobs (reserves / buffers) used by the snapshot. */
export const financeSettings = pgTable('finance_settings', {
  businessId: uuid('business_id')
    .primaryKey()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  taxReserveCents: integer('tax_reserve_cents').notNull().default(0),
  opsBufferCurrentCents: integer('ops_buffer_current_cents').notNull().default(0),
  opsBufferTargetCents: integer('ops_buffer_target_cents').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
