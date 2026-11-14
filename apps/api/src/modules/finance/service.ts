/**
 * Finance domain — lists + aggregated snapshot for the UI.
 * Mutations live in ./crud.ts; pure helpers in period/aggregate/money.
 * Location: apps/api/src/modules/finance/service.ts
 */
import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm'
import type { FinancePeriod, FinanceSnapshot } from '@bu2/shared'
import { db } from '../../db/client.js'
import {
  contacts,
  financeAccounts,
  financeSettings,
  financeTransactions,
} from '../../db/schema.js'
import { categoryBars, emptySnapshot, monthBuckets, sumKind } from './aggregate.js'
import { centsToEur } from './money.js'
import { accountToClient, txToClient } from './mappers.js'
import { periodRange } from './period.js'

export { centsToEur } from './money.js'
export { periodRange } from './period.js'
export { emptySnapshot, sumKind, monthBuckets, categoryBars } from './aggregate.js'
export { accountToClient, txToClient } from './mappers.js'
export {
  archiveAccount,
  createAccount,
  createTransaction,
  deleteTransaction,
  patchAccount,
  patchTransaction,
  upsertSettings,
} from './crud.js'

export async function listAccounts(businessId: string) {
  const rows = await db
    .select()
    .from(financeAccounts)
    .where(and(eq(financeAccounts.businessId, businessId), isNull(financeAccounts.archivedAt)))
    .orderBy(desc(financeAccounts.updatedAt))
  return rows.map(accountToClient)
}

export async function listTransactions(
  businessId: string,
  opts?: { from?: string; to?: string; limit?: number },
) {
  const clauses = [eq(financeTransactions.businessId, businessId)]
  if (opts?.from) clauses.push(gte(financeTransactions.bookedOn, opts.from))
  if (opts?.to) clauses.push(lte(financeTransactions.bookedOn, opts.to))
  const rows = await db
    .select()
    .from(financeTransactions)
    .where(and(...clauses))
    .orderBy(desc(financeTransactions.bookedOn), desc(financeTransactions.createdAt))
    .limit(opts?.limit ?? 500)
  return rows
}

export async function buildSnapshot(
  businessId: string,
  period: FinancePeriod = 'current',
): Promise<FinanceSnapshot> {
  const range = periodRange(period)
  const [accounts, settingsRows, periodTx, prevTx, allOpen] = await Promise.all([
    listAccounts(businessId),
    db
      .select()
      .from(financeSettings)
      .where(eq(financeSettings.businessId, businessId))
      .limit(1),
    listTransactions(businessId, { from: range.from, to: range.to, limit: 1000 }),
    listTransactions(businessId, { from: range.prevFrom, to: range.prevTo, limit: 1000 }),
    listTransactions(businessId, { limit: 2000 }),
  ])

  const settings = settingsRows[0]
  const hasData = accounts.length > 0 || periodTx.length > 0
  if (!hasData) return emptySnapshot(period)

  const balanceCents = accounts.reduce((a, x) => a + x.balanceCents, 0)
  const revenueCents = sumKind(periodTx, 'income', ['paid'])
  const costsCents = sumKind(periodTx, 'expense', ['paid', 'overdue'])
  const prevRevenue = sumKind(prevTx, 'income', ['paid'])
  const obligationsCents = sumKind(allOpen, 'expense', ['planned', 'overdue'])
  const openIncomingCents = sumKind(allOpen, 'income', ['planned'])
  const taxReserve = settings?.taxReserveCents ?? 0
  const opsCurrent = settings?.opsBufferCurrentCents ?? 0
  const opsTarget = settings?.opsBufferTargetCents ?? 0
  const reservesCents = taxReserve + opsCurrent
  const freeCents = balanceCents - obligationsCents - reservesCents

  const revenueDeltaPct =
    prevRevenue > 0
      ? Math.round(((revenueCents - prevRevenue) / prevRevenue) * 1000) / 10
      : null

  const { categories, top, costTotal } = categoryBars(periodTx)

  const recurringMap = new Map<string, { name: string; detail: string; amount: number }>()
  for (const r of allOpen) {
    if (!r.recurring) continue
    const key = `${r.kind}:${r.name}`
    recurringMap.set(key, {
      name: r.name,
      detail: r.category,
      amount: r.kind === 'expense' ? -centsToEur(r.amountCents) : centsToEur(r.amountCents),
    })
  }

  const planned = allOpen
    .filter((r) => r.status === 'planned' || r.status === 'overdue')
    .sort((a, b) => a.bookedOn.localeCompare(b.bookedOn))

  const nextPayment = planned.find((r) => r.kind === 'expense')
  const liquidityFlows = planned.slice(0, 12).map((r) => ({
    date: r.bookedOn,
    title: r.name,
    detail: r.category,
    amount: r.kind === 'expense' ? -centsToEur(r.amountCents) : centsToEur(r.amountCents),
  }))

  function minByDays(days: number): number | null {
    const cutoff = new Date()
    cutoff.setUTCDate(cutoff.getUTCDate() + days)
    const cutoffIso = cutoff.toISOString().slice(0, 10)
    let run = freeCents
    let min = freeCents
    for (const r of planned) {
      if (r.bookedOn > cutoffIso) continue
      run += r.kind === 'expense' ? -r.amountCents : r.amountCents
      if (run < min) min = run
    }
    return centsToEur(min)
  }

  const contactRows =
    periodTx.some((t) => t.contactId) || allOpen.some((t) => t.contactId)
      ? await db
          .select({ id: contacts.id, displayName: contacts.displayName })
          .from(contacts)
          .where(eq(contacts.businessId, businessId))
      : []
  const contactName = new Map(contactRows.map((c) => [c.id, c.displayName]))

  const byCustomer = new Map<string, { income: number; expense: number }>()
  const byProject = new Map<string, { income: number; expense: number }>()
  for (const r of periodTx) {
    if (r.status === 'planned') continue
    if (r.contactId) {
      const label = contactName.get(r.contactId) ?? 'Kontakt'
      const cur = byCustomer.get(label) ?? { income: 0, expense: 0 }
      if (r.kind === 'income') cur.income += r.amountCents
      else cur.expense += r.amountCents
      byCustomer.set(label, cur)
    }
    if (r.projectLabel) {
      const cur = byProject.get(r.projectLabel) ?? { income: 0, expense: 0 }
      if (r.kind === 'income') cur.income += r.amountCents
      else cur.expense += r.amountCents
      byProject.set(r.projectLabel, cur)
    }
  }

  const customers = [...byCustomer.entries()]
    .map(
      ([name, v]) =>
        [name, centsToEur(v.income), centsToEur(v.income - v.expense)] as [string, number, number],
    )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
  const projects = [...byProject.entries()]
    .map(
      ([name, v]) =>
        [name, centsToEur(v.income), centsToEur(v.income - v.expense)] as [string, number, number],
    )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  const analysisSeries = monthBuckets(periodTx, range.from, range.to)
  const marginPct =
    revenueCents > 0
      ? Math.round(((revenueCents - costsCents) / revenueCents) * 1000) / 10
      : null

  const alerts: FinanceSnapshot['alerts'] = []
  if (obligationsCents > balanceCents) {
    alerts.push({
      id: 'overcommitted',
      tone: 'red',
      title: 'Verpflichtungen übersteigen Saldo',
      detail: 'Geplante und überfällige Ausgaben liegen über dem Kontostand.',
      go: 'transactions',
    })
  }
  if (opsTarget > 0 && opsCurrent < opsTarget) {
    alerts.push({
      id: 'ops-buffer',
      tone: 'warn',
      title: 'Betriebsreserve unter Ziel',
      detail: `Aktuell ${centsToEur(opsCurrent).toFixed(0)} € von ${centsToEur(opsTarget).toFixed(0)} € Ziel.`,
      go: 'settings',
    })
  }

  const paidDrift =
    periodTx.filter((r) => r.status === 'paid').length > 0
      ? centsToEur(revenueCents - costsCents)
      : 0

  return {
    freeAvailable: centsToEur(freeCents),
    balance: centsToEur(balanceCents),
    obligations: centsToEur(obligationsCents),
    reserves: centsToEur(reservesCents),
    liquidityOutlook: minByDays(90),
    reserveProgress:
      opsTarget > 0 || taxReserve > 0
        ? {
            current: centsToEur(opsCurrent + taxReserve),
            target: centsToEur(opsTarget + taxReserve),
          }
        : null,
    nextPayment: nextPayment
      ? `${nextPayment.bookedOn} · ${nextPayment.name} · ${centsToEur(nextPayment.amountCents).toFixed(2)} €`
      : null,
    openIncoming: centsToEur(openIncomingCents),
    revenue: centsToEur(revenueCents),
    costs: centsToEur(costsCents),
    result: centsToEur(revenueCents - costsCents),
    revenueDeltaPct,
    topCostShare: top ? `${top[0]} · ${Math.round((top[1] / costTotal) * 100)} %` : null,
    alerts,
    transactions: periodTx.map(txToClient),
    recurring: [...recurringMap.values()],
    analysis: {
      ...analysisSeries,
      categories,
      marginPct,
      topDriverPct: top ? Math.round((top[1] / costTotal) * 1000) / 10 : null,
      topDriverName: top?.[0] ?? null,
    },
    liquidityFlows,
    liquidityMinByHorizon: {
      30: minByDays(30),
      60: minByDays(60),
      90: minByDays(90),
    },
    taxReserve: settings ? centsToEur(taxReserve) : null,
    opsBuffer:
      settings && (opsTarget > 0 || opsCurrent > 0)
        ? { current: centsToEur(opsCurrent), target: centsToEur(opsTarget) }
        : null,
    profitability: {
      customers,
      products: [],
      projects,
      directCosts: centsToEur(costsCents),
      contribution: centsToEur(revenueCents - costsCents),
      breakEven: costsCents > 0 ? centsToEur(costsCents) : null,
    },
    planningBaseBalance: centsToEur(balanceCents),
    planningMonthlyDrift: paidDrift,
    accounts,
    period,
    hasData: true,
  }
}
