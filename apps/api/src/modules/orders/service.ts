/**
 * Orders domain — template readiness, A-number allocation, DTOs.
 * Location: apps/api/src/modules/orders/service.ts
 */
import { eq, sql } from 'drizzle-orm'
import {
  ORDER_NUMBER_START,
  formatOrderNumber,
  isOrderTemplateReady,
  type OrderTemplateBlock,
  type OrderTemplateSnapshot,
} from '@bu2/shared'
import { db } from '../../db/client.js'
import { productOrders, type OrderTemplateSnapshot as DbSnapshot } from '../../db/schema.js'

export { ORDER_NUMBER_START, formatOrderNumber, isOrderTemplateReady }

export async function allocateOrderNumber(businessId: string): Promise<number> {
  const [row] = await db
    .select({
      max: sql<number>`coalesce(max(${productOrders.orderNumber}), ${ORDER_NUMBER_START - 1})`,
    })
    .from(productOrders)
    .where(eq(productOrders.businessId, businessId))
  return Number(row?.max ?? ORDER_NUMBER_START - 1) + 1
}

export function normalizeBlocks(raw: unknown): OrderTemplateBlock[] {
  if (!Array.isArray(raw)) return []
  const out: OrderTemplateBlock[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const type = o.type
    if (type !== 'text' && type !== 'heading' && type !== 'divider') continue
    const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : crypto.randomUUID()
    const body = typeof o.body === 'string' ? o.body : ''
    out.push({ id, type, body })
  }
  return out
}

export function toTemplateSnapshot(title: string, blocks: OrderTemplateBlock[]): OrderTemplateSnapshot {
  return { title: title.trim(), blocks }
}

export function toOrderClient(
  row: typeof productOrders.$inferSelect,
  extras?: { customerName?: string | null; productName?: string | null },
) {
  const snapshot = (row.snapshot || { title: '', blocks: [] }) as DbSnapshot
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    orderNumberLabel: formatOrderNumber(row.orderNumber),
    productId: row.productId,
    productName: extras?.productName ?? null,
    customerId: row.customerId,
    customerName: extras?.customerName ?? null,
    status: row.status,
    title: row.title,
    amountCents: row.amountCents,
    currency: row.currency,
    notes: row.notes,
    snapshot,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toTemplateClient(row: {
  id: string
  productId: string
  title: string
  blocks: unknown
  updatedAt: Date
  createdAt: Date
}) {
  const blocks = normalizeBlocks(row.blocks)
  const title = row.title || ''
  return {
    id: row.id,
    productId: row.productId,
    title,
    blocks,
    ready: isOrderTemplateReady({ title, blocks }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
