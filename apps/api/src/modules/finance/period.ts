/**
 * Finance period windows for snapshot aggregation.
 * Location: apps/api/src/modules/finance/period.ts
 */
import type { FinancePeriod } from '@bu2/shared'

export type PeriodRange = {
  from: string
  to: string
  prevFrom: string
  prevTo: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function iso(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** Inclusive date windows for current / previous / rolling 90d (UTC). */
export function periodRange(period: FinancePeriod, now = new Date()): PeriodRange {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()

  if (period === '90d') {
    const to = new Date(Date.UTC(y, m, now.getUTCDate()))
    const from = new Date(to)
    from.setUTCDate(from.getUTCDate() - 89)
    const prevTo = new Date(from)
    prevTo.setUTCDate(prevTo.getUTCDate() - 1)
    const prevFrom = new Date(prevTo)
    prevFrom.setUTCDate(prevFrom.getUTCDate() - 89)
    return { from: iso(from), to: iso(to), prevFrom: iso(prevFrom), prevTo: iso(prevTo) }
  }

  if (period === 'prev') {
    const from = new Date(Date.UTC(y, m - 1, 1))
    const to = new Date(Date.UTC(y, m, 0))
    const prevFrom = new Date(Date.UTC(y, m - 2, 1))
    const prevTo = new Date(Date.UTC(y, m - 1, 0))
    return { from: iso(from), to: iso(to), prevFrom: iso(prevFrom), prevTo: iso(prevTo) }
  }

  const from = new Date(Date.UTC(y, m, 1))
  const to = new Date(Date.UTC(y, m + 1, 0))
  const prevFrom = new Date(Date.UTC(y, m - 1, 1))
  const prevTo = new Date(Date.UTC(y, m, 0))
  return { from: iso(from), to: iso(to), prevFrom: iso(prevFrom), prevTo: iso(prevTo) }
}
