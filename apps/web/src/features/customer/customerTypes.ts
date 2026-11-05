/**
 * Customer CRM client types — derived from @bu2/shared DTOs where available.
 * Location: apps/web/src/features/customer/customerTypes.ts
 */
import type { CustomerDto, CustomerNoteDto } from '@bu2/shared'

export type BuCustomer = CustomerDto
export type BuCustomerNote = CustomerNoteDto

export type BuCustomerPurchase = {
  id: string
  productId: string | null
  label: string
  amountCents: number
  currency: string
  purchasedAt: string
}

export type BuCustomerStats = {
  ltvCents: number
  currency: string
  customerSince: string
  customerDays: number
  purchaseCount: number
  persona: { id: string; name: string; summary: string | null } | null
  products: { productId: string | null; name: string; amountCents: number }[]
  purchases: BuCustomerPurchase[]
}

export type BuCustomerConsent = {
  id: string
  purpose: string
  channel: string
  grantedAt: string | null
  revokedAt: string | null
  evidence: string | null
  createdAt: string
}

export type BuCustomerEvent = {
  id: string
  type: string
  summary: string
  actorUserId: string | null
  actorDisplayName?: string | null
  meta: Record<string, unknown>
  createdAt: string
}

export type BuLinkedTask = {
  id: string
  title: string
  status: string
  projectId: string | null
  dueAt: string | null
}
