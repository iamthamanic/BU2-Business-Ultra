/**
 * Finance view model — empty until bank/bookkeeping connectors provide data.
 * Location: apps/web/src/features/finance/financeModel.ts
 */

export type FinanceTx = {
  id: string
  date: string
  name: string
  desc: string
  category: string
  project: string
  status: 'Bezahlt' | 'Überfällig' | 'Geplant'
  kind: 'income' | 'expense'
  source: string
  amount: number
  recurring: boolean
}

export type FinanceAlert = {
  id: string
  tone: 'red' | 'warn' | 'blue'
  title: string
  detail: string
  go: 'transactions' | 'analysis' | 'settings'
}

export type FinanceCategoryBar = {
  name: string
  amount: number
  pct: number
  color: string
}

export type FinanceFlow = {
  date: string
  title: string
  detail: string
  amount: number
}

export type FinanceRecurring = {
  name: string
  detail: string
  amount: number
}

/** Snapshot used by all Finance tabs — zeros / empty until a live source exists. */
export type FinanceSnapshot = {
  freeAvailable: number | null
  balance: number | null
  obligations: number | null
  reserves: number | null
  liquidityOutlook: number | null
  reserveProgress: { current: number; target: number } | null
  nextPayment: string | null
  openIncoming: number | null
  revenue: number | null
  costs: number | null
  result: number | null
  revenueDeltaPct: number | null
  topCostShare: string | null
  alerts: FinanceAlert[]
  transactions: FinanceTx[]
  recurring: FinanceRecurring[]
  analysis: {
    cost: number[]
    revenue: number[]
    result: number[]
    categories: FinanceCategoryBar[]
    marginPct: number | null
    topDriverPct: number | null
    topDriverName: string | null
  }
  liquidityFlows: FinanceFlow[]
  liquidityMinByHorizon: Record<30 | 60 | 90, number | null>
  taxReserve: number | null
  opsBuffer: { current: number; target: number } | null
  profitability: {
    customers: [string, number, number][]
    products: [string, number, number][]
    projects: [string, number, number][]
    directCosts: number | null
    contribution: number | null
    breakEven: number | null
  }
  /** Base cash for planning scenarios when no live balance exists. */
  planningBaseBalance: number
  planningMonthlyDrift: number
}

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
