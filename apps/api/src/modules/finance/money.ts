/**
 * Finance money helpers — cents ↔ EUR and status labels.
 * Location: apps/api/src/modules/finance/money.ts
 */
import type { FinanceTxStatus, FinanceTxStatusLabel } from '@bu2/shared'

export const STATUS_LABEL: Record<FinanceTxStatus, FinanceTxStatusLabel> = {
  paid: 'Bezahlt',
  overdue: 'Überfällig',
  planned: 'Geplant',
}

export const CATEGORY_COLORS = [
  '#5b8def',
  '#3ecf8e',
  '#f5a623',
  '#e85d5d',
  '#9b7bff',
  '#6b7280',
]

export function centsToEur(cents: number): number {
  return Math.round(cents) / 100
}
