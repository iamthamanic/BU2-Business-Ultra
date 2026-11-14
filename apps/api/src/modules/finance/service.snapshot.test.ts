/**
 * Finance pure helpers — period + aggregation goldens (no DB).
 * Location: apps/api/src/modules/finance/service.snapshot.test.ts
 */
import { describe, expect, it } from 'vitest'
import { categoryBars, emptySnapshot, monthBuckets, sumKind } from './aggregate.js'
import { centsToEur } from './money.js'
import { periodRange } from './period.js'

describe('finance centsToEur', () => {
  it('converts minor units to euro', () => {
    expect(centsToEur(0)).toBe(0)
    expect(centsToEur(199)).toBe(1.99)
    expect(centsToEur(10050)).toBe(100.5)
  })
})

describe('finance periodRange', () => {
  const now = new Date('2026-11-15T12:00:00Z')

  it('current month window', () => {
    expect(periodRange('current', now)).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
      prevFrom: '2026-10-01',
      prevTo: '2026-10-31',
    })
  })

  it('previous month window', () => {
    expect(periodRange('prev', now)).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
      prevFrom: '2026-09-01',
      prevTo: '2026-09-30',
    })
  })

  it('rolling 90d window', () => {
    const r = periodRange('90d', now)
    expect(r.to).toBe('2026-11-15')
    expect(r.from).toBe('2026-08-18')
  })
})

describe('finance aggregation', () => {
  const rows = [
    {
      bookedOn: '2026-11-02',
      kind: 'income',
      status: 'paid',
      category: 'Umsatz',
      amountCents: 10_000,
      name: 'Rechnung',
      recurring: false,
      contactId: null,
      projectLabel: null,
    },
    {
      bookedOn: '2026-11-05',
      kind: 'expense',
      status: 'paid',
      category: 'Miete',
      amountCents: 3_000,
      name: 'Büro',
      recurring: true,
      contactId: null,
      projectLabel: 'Ops',
    },
    {
      bookedOn: '2026-11-20',
      kind: 'expense',
      status: 'planned',
      category: 'Miete',
      amountCents: 3_000,
      name: 'Büro geplant',
      recurring: true,
      contactId: null,
      projectLabel: null,
    },
  ]

  it('sumKind respects status filter', () => {
    expect(sumKind(rows, 'income', ['paid'])).toBe(10_000)
    expect(sumKind(rows, 'expense', ['paid', 'overdue'])).toBe(3_000)
    expect(sumKind(rows, 'expense', ['planned'])).toBe(3_000)
  })

  it('monthBuckets skips planned', () => {
    const b = monthBuckets(rows, '2026-11-01', '2026-11-30')
    expect(b.revenue).toEqual([100])
    expect(b.cost).toEqual([30])
    expect(b.result).toEqual([70])
  })

  it('categoryBars ranks paid expenses', () => {
    const { categories, top } = categoryBars(rows)
    expect(top?.[0]).toBe('Miete')
    expect(categories[0]?.name).toBe('Miete')
    expect(categories[0]?.amount).toBe(30)
  })

  it('emptySnapshot is hasData false', () => {
    const s = emptySnapshot('current')
    expect(s.hasData).toBe(false)
    expect(s.accounts).toEqual([])
    expect(s.transactions).toEqual([])
    expect(s.balance).toBeNull()
  })
})
