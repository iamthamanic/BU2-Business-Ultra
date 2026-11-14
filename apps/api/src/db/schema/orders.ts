/**
 * Drizzle schema — product order templates + orders.
 * Location: apps/api/src/db/schema/orders.ts
 */
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { businesses } from './identity.js'
import { contacts, products } from './crm.js'

export type OrderTemplateBlock = {
  id: string
  type: 'text' | 'heading' | 'divider'
  body: string
}

export type OrderTemplateSnapshot = {
  title: string
  blocks: OrderTemplateBlock[]
}

/** One order-design template per product (V1). */
export const productOrderTemplates = pgTable(
  'product_order_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull().default(''),
    blocks: jsonb('blocks').$type<OrderTemplateBlock[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('product_order_templates_biz_product_uidx').on(t.businessId, t.productId),
  ],
)

/** Concrete orders — A-number, customer, product, frozen template snapshot. */
export const productOrders = pgTable(
  'product_orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    orderNumber: integer('order_number').notNull(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'restrict' }),
    status: varchar('status', { length: 16 }).notNull().default('draft'),
    title: varchar('title', { length: 200 }).notNull(),
    amountCents: integer('amount_cents').notNull().default(0),
    currency: varchar('currency', { length: 3 }).notNull().default('EUR'),
    notes: text('notes'),
    snapshot: jsonb('snapshot').$type<OrderTemplateSnapshot>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('product_orders_biz_number_uidx').on(t.businessId, t.orderNumber),
  ],
)
