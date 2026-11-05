/**
 * Drizzle schema — integrations ownership tables.
 * Location: apps/api/src/db/schema/integrations.ts
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

export const businessIntegrations = pgTable(
  'business_integrations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 40 }).notNull(),
    externalId: varchar('external_id', { length: 120 }).notNull(),
    label: varchar('label', { length: 160 }),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('business_integrations_biz_provider_ext_uidx').on(
      t.businessId,
      t.provider,
      t.externalId,
    ),
  ],
)

/** Company products (SoR for Product UI — description, calc, persona links). */
export const connections = pgTable(
  'connections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 40 }).notNull(),
    authMethod: varchar('auth_method', { length: 32 }).notNull(),
    externalAccountId: varchar('external_account_id', { length: 160 }).notNull(),
    displayName: varchar('display_name', { length: 160 }),
    status: varchar('status', { length: 24 }).notNull().default('pending'),
    accountType: varchar('account_type', { length: 80 }),
    health: jsonb('health').$type<Record<string, unknown>>().notNull().default({}),
    capabilitiesCache: jsonb('capabilities_cache')
      .$type<Record<string, unknown>[]>()
      .notNull()
      .default([]),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('connections_biz_provider_ext_uidx').on(
      t.businessId,
      t.provider,
      t.externalAccountId,
    ),
  ],
)

/** Encrypted credentials for a connection (many kinds: access, refresh, bot_token). */
export const connectionCredentials = pgTable(
  'connection_credentials',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 40 }).notNull(),
    ciphertext: text('ciphertext').notNull(),
    iv: text('iv').notNull(),
    tag: text('tag').notNull(),
    keyHint: varchar('key_hint', { length: 12 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('connection_credentials_conn_kind_uidx').on(t.connectionId, t.kind)],
)

/** Which BU2 module uses a connection for which purpose. */
export const moduleBindings = pgTable(
  'module_bindings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    module: varchar('module', { length: 40 }).notNull(),
    purpose: varchar('purpose', { length: 40 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('module_bindings_conn_mod_purpose_uidx').on(t.connectionId, t.module, t.purpose),
  ],
)

/** Sync cursors / delta tokens per connection stream. */
export const syncCursors = pgTable(
  'sync_cursors',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    stream: varchar('stream', { length: 80 }).notNull(),
    cursor: text('cursor').notNull().default(''),
    renewedAt: timestamp('renewed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sync_cursors_conn_stream_uidx').on(t.connectionId, t.stream)],
)

/** Channel identity → optional CRM customer (provisional until confirmed). */
export const outboxJobs = pgTable('outbox_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  connectionId: uuid('connection_id')
    .notNull()
    .references(() => connections.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 40 }).notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  status: varchar('status', { length: 24 }).notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }).notNull().defaultNow(),
  lastError: varchar('last_error', { length: 500 }),
  providerRef: varchar('provider_ref', { length: 200 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
