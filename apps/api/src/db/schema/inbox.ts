/**
 * Drizzle schema — inbox ownership tables.
 * Location: apps/api/src/db/schema/inbox.ts
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
import { customers } from './crm.js'
import { connections } from './integrations.js'

export const contactIdentities = pgTable(
  'contact_identities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    kind: varchar('kind', { length: 40 }).notNull(),
    value: varchar('value', { length: 320 }).notNull(),
    displayName: varchar('display_name', { length: 200 }),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    confidence: varchar('confidence', { length: 16 }).notNull().default('medium'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('contact_identities_biz_kind_value_uidx').on(t.businessId, t.kind, t.value)],
)

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    channel: varchar('channel', { length: 32 }).notNull(),
    externalThreadId: varchar('external_thread_id', { length: 160 }).notNull(),
    title: varchar('title', { length: 200 }),
    status: varchar('status', { length: 24 }).notNull().default('open'),
    assigneeUserId: uuid('assignee_user_id').references(() => users.id, { onDelete: 'set null' }),
    contactIdentityId: uuid('contact_identity_id').references(() => contactIdentities.id, {
      onDelete: 'set null',
    }),
    /** Inbound messages since last open; cleared when a member opens the thread. */
    unreadCount: integer('unread_count').notNull().default(0),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    lastPreview: varchar('last_preview', { length: 280 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('conversations_conn_thread_uidx').on(t.connectionId, t.externalThreadId),
  ],
)

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    direction: varchar('direction', { length: 16 }).notNull(),
    providerMessageId: varchar('provider_message_id', { length: 200 }).notNull(),
    bodyText: text('body_text').notNull().default(''),
    deliveryStatus: varchar('delivery_status', { length: 24 }).notNull().default('received'),
    errorDetail: varchar('error_detail', { length: 500 }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    raw: jsonb('raw').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [uniqueIndex('messages_conn_provider_msg_uidx').on(t.connectionId, t.providerMessageId)],
)

