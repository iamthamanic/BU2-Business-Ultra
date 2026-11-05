/**
 * Customer CRM client types. Location: apps/web/src/features/customers/customerTypes.ts
 */
export type BuCustomer = {
  id: string
  kind: string
  displayName: string
  firstName?: string | null
  lastName?: string | null
  orgCustomerId?: string | null
  orgCustomer?: { id: string; displayName: string } | null
  email: string | null
  phone: string | null
  address: string | null
  street: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  billingStreet: string | null
  billingPostalCode: string | null
  billingCity: string | null
  billingCountry: string | null
  relationStatus: string
  birthDate: string | null
  photoUrl: string | null
  buyerPersonaId: string | null
  tags: string[]
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

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

export type BuCustomerNote = {
  id: string
  body: string
  authorUserId: string | null
  authorDisplayName?: string | null
  parentNoteId?: string | null
  createdAt: string
  updatedAt?: string
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
