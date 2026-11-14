/**
 * orderTypes — client shapes for product orders list/create.
 * Location: apps/web/src/features/products/orderTypes.ts
 */
import type { OrderStatus, OrderTemplateSnapshot } from '@bu2/shared'

export type BuProductOrder = {
  id: string
  orderNumber: number
  orderNumberLabel: string
  productId: string
  productName: string | null
  customerId: string
  customerName: string | null
  status: OrderStatus
  title: string
  amountCents: number
  currency: string
  notes: string | null
  snapshot: OrderTemplateSnapshot
  createdAt: string
  updatedAt: string
}
