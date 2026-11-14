/**
 * Finance view model — helpers + empty snapshot aligned with `@bu2/shared`.
 * Location: apps/web/src/features/finance/financeModel.ts
 */
import type { FinanceSnapshot, FinanceTxClient } from '@bu2/shared'

export type { FinanceSnapshot }
export type FinanceTx = FinanceTxClient

export type FinanceAlert = FinanceSnapshot['alerts'][number]
export type FinanceCategoryBar = FinanceSnapshot['analysis']['categories'][number]
export type FinanceFlow = FinanceSnapshot['liquidityFlows'][number]
export type FinanceRecurring = FinanceSnapshot['recurring'][number]

/** Empty snapshot until `/finance/snapshot` returns hasData. */
export const EMPTY_FINANCE: FinanceSnapshot = {
  freeAvailable: null,
  balance: null,
  obligations: null,
  reserves: null,
  liquidityOutlook: null,
  reserveProgress: null,
  nextPayment: null,
  openIncoming: null,
  revenue: null,
  costs: null,
  result: null,
  revenueDeltaPct: null,
  topCostShare: null,
  alerts: [],
  transactions: [],
  recurring: [],
  analysis: {
    cost: [],
    revenue: [],
    result: [],
    categories: [],
    marginPct: null,
    topDriverPct: null,
    topDriverName: null,
  },
  liquidityFlows: [],
  liquidityMinByHorizon: { 30: null, 60: null, 90: null },
  taxReserve: null,
  opsBuffer: null,
  profitability: {
    customers: [],
    products: [],
    projects: [],
    directCosts: null,
    contribution: null,
    breakEven: null,
  },
  planningBaseBalance: 0,
  planningMonthlyDrift: 0,
  accounts: [],
  period: 'current',
  hasData: false,
}

export function formatEur(n: number, fraction = 0): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: fraction,
    minimumFractionDigits: fraction,
  }).format(n)
}

export function formatEurOrDash(n: number | null, fraction = 0): string {
  if (n === null) return '—'
  return formatEur(n, fraction)
}
