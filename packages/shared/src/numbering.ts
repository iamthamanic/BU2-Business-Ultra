/**
 * Business document / contact numbering — shared labels (K-/P-/A- + 6 digits).
 * Location: packages/shared/src/numbering.ts
 */

export const CUSTOMER_NUMBER_START = 100100
export const PARTNER_NUMBER_START = 100100
export const ORDER_NUMBER_START = 100100

export function formatCustomerNumber(n: number): string {
  return `K-${String(n).padStart(6, '0')}`
}

export function formatPartnerNumber(n: number): string {
  return `P-${String(n).padStart(6, '0')}`
}

export function formatOrderNumber(n: number): string {
  return `A-${String(n).padStart(6, '0')}`
}
