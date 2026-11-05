/**
 * Drizzle schema — tools ownership tables.
 * Location: apps/api/src/db/schema/tools.ts
 */
import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

import { businesses, users } from './identity.js'

export const cmbModels = pgTable('cmb_models', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  model: jsonb('model').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const cmbSnapshots = pgTable('cmb_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  modelId: uuid('model_id')
    .notNull()
    .references(() => cmbModels.id, { onDelete: 'cascade' }),
  snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Tenant-installed tools (custom URL apps + future manifests). One row per manifest_id. */
export const toolInstalls = pgTable(
  'tool_installs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    manifestId: varchar('manifest_id', { length: 80 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    entryUrl: text('entry_url').notNull(),
    iconKey: varchar('icon_key', { length: 40 }).notNull().default('puzzle'),
    scopes: jsonb('scopes').$type<Record<string, { read?: boolean; write?: boolean }>>().notNull().default({}),
    kind: varchar('kind', { length: 24 }).notNull().default('custom'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('tool_installs_biz_manifest_uidx').on(t.businessId, t.manifestId)],
)

export const personas = pgTable('personas', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  summary: text('summary'),
  goals: jsonb('goals').$type<string[]>().default([]),
  pains: jsonb('pains').$type<string[]>().default([]),
  channels: jsonb('channels').$type<string[]>().default([]),
  journey: jsonb('journey').$type<unknown>().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const openseoInstances = pgTable('openseo_instances', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' })
    .unique(),
  status: varchar('status', { length: 40 }).notNull().default('not_provisioned'),
  baseUrl: text('base_url'),
  provisionMeta: jsonb('provision_meta').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const openseoIdentities = pgTable(
  'openseo_identities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    openseoUserRef: varchar('openseo_user_ref', { length: 120 }).notNull(),
    roleMapped: varchar('role_mapped', { length: 40 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('openseo_identities_biz_user_uidx').on(t.businessId, t.userId)],
)

export const openseoHandoffs = pgTable('openseo_handoffs', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

