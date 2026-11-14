/**
 * Pure finance aggregation helpers (no DB).
 * Location: apps/api/src/modules/finance/aggregate.ts
 */
import type { FinancePeriod, FinanceSnapshot, FinanceTxStatus } from '@bu2/shared'
import { CATEGORY_COLORS, centsToEur } from './money.js'

export type TxAggRow = {
  bookedOn: string
  kind: string
  status: string
  category: string
  amountCents: number
  name: string
  recurring: boolean
  contactId: string | null
  projectLabel: string | null
}

export function sumKind(
  rows: TxAggRow[],
  kind: 'income' | 'expense',
  statusFilter?: FinanceTxStatus[],
): number {
  return rows.reduce((acc, r) => {
    if (r.kind !== kind) return acc
    if (statusFilter && !statusFilter.includes(r.status as FinanceTxStatus)) return acc
    return acc + r.amountCents
  }, 0)
}

export function monthBuckets(
  rows: TxAggRow[],
  from: string,
  to: string,
): { cost: number[]; revenue: number[]; result: number[] } {
  const start = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  const months: string[] = []
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
  while (cursor <= end) {
    months.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`)
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  if (months.length === 0) months.push(from.slice(0, 7))

  const cost: number[] = []
  const revenue: number[] = []
  const result: number[] = []
  for (const key of months) {
    let inc = 0
    let exp = 0
    for (const r of rows) {
      if (!r.bookedOn.startsWith(key)) continue
      if (r.status === 'planned') continue
      if (r.kind === 'income') inc += r.amountCents
      else exp += r.amountCents
    }
    revenue.push(centsToEur(inc))
    cost.push(centsToEur(exp))
    result.push(centsToEur(inc - exp))
  }
  return { cost, revenue, result }
}

export function categoryBars(rows: TxAggRow[]) {
  const catMap = new Map<string, number>()
  for (const r of rows) {
    if (r.kind !== 'expense' || r.status === 'planned') continue
    catMap.set(r.category, (catMap.get(r.category) ?? 0) + r.amountCents)
  }
  const catSorted = [...catMap.entries()].sort((a, b) => b[1] - a[1])
  const costTotal = catSorted.reduce((a, [, v]) => a + v, 0) || 1
  const categories = catSorted.slice(0, 6).map(([name, amount], i) => ({
    name,
    amount: centsToEur(amount),
    pct: Math.round((amount / costTotal) * 1000) / 10,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length]!,
  }))
  return { categories, top: catSorted[0] ?? null, costTotal }
}

export function emptySnapshot(period: FinancePeriod): FinanceSnapshot {
  return {
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
    period,
    hasData: false,
  }
}
