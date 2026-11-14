/**
 * Finance row → client DTO mappers.
 * Location: apps/api/src/modules/finance/mappers.ts
 */
import type { FinanceAccountClient, FinanceTxClient, FinanceTxStatus } from '@bu2/shared'
import { financeAccounts, financeTransactions } from '../../db/schema.js'
import { STATUS_LABEL, centsToEur } from './money.js'

export function accountToClient(
  row: typeof financeAccounts.$inferSelect,
): FinanceAccountClient {
  return {
    id: row.id,
    name: row.name,
    iban: row.iban,
    bankName: row.bankName,
    currency: row.currency,
    balanceCents: row.balanceCents,
    connectionId: row.connectionId,
    source: row.source,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function txToClient(row: typeof financeTransactions.$inferSelect): FinanceTxClient {
  const status = (row.status as FinanceTxStatus) in STATUS_LABEL
    ? (row.status as FinanceTxStatus)
    : 'paid'
  return {
    id: row.id,
    date: row.bookedOn,
    name: row.name,
    desc: row.description,
    category: row.category,
    project: row.projectLabel ?? '—',
    status: STATUS_LABEL[status],
    kind: row.kind as 'income' | 'expense',
    source: row.source,
    amount: centsToEur(row.amountCents),
    recurring: row.recurring,
    accountId: row.accountId,
    contactId: row.contactId,
  }
}
