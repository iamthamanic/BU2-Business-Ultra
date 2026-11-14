/**
 * Finance account / transaction / settings mutations.
 * Location: apps/api/src/modules/finance/crud.ts
 */
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { financeAccounts, financeSettings, financeTransactions } from '../../db/schema.js'
import { accountToClient, txToClient } from './mappers.js'

export async function createAccount(
  businessId: string,
  input: {
    name: string
    iban?: string | null
    bankName?: string | null
    currency?: string
    balanceCents?: number
    connectionId?: string | null
    source?: string
  },
) {
  const [row] = await db
    .insert(financeAccounts)
    .values({
      businessId,
      name: input.name,
      iban: input.iban ?? null,
      bankName: input.bankName ?? null,
      currency: input.currency ?? 'EUR',
      balanceCents: input.balanceCents ?? 0,
      connectionId: input.connectionId ?? null,
      source: input.source ?? 'manual',
    })
    .returning()
  return accountToClient(row!)
}

export async function patchAccount(
  businessId: string,
  id: string,
  input: Partial<{
    name: string
    iban: string | null
    bankName: string | null
    currency: string
    balanceCents: number
    connectionId: string | null
    source: string
  }>,
) {
  const [row] = await db
    .update(financeAccounts)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.iban !== undefined ? { iban: input.iban } : {}),
      ...(input.bankName !== undefined ? { bankName: input.bankName } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.balanceCents !== undefined ? { balanceCents: input.balanceCents } : {}),
      ...(input.connectionId !== undefined ? { connectionId: input.connectionId } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      updatedAt: sql`now()`,
    })
    .where(and(eq(financeAccounts.id, id), eq(financeAccounts.businessId, businessId)))
    .returning()
  return row ? accountToClient(row) : null
}

export async function archiveAccount(businessId: string, id: string) {
  const [row] = await db
    .update(financeAccounts)
    .set({ archivedAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(financeAccounts.id, id), eq(financeAccounts.businessId, businessId)))
    .returning()
  return row ? accountToClient(row) : null
}

export async function createTransaction(
  businessId: string,
  input: {
    accountId: string
    bookedOn: string
    name: string
    description?: string
    category?: string
    projectLabel?: string | null
    contactId?: string | null
    status?: string
    kind: 'income' | 'expense'
    source?: string
    amountCents: number
    recurring?: boolean
    externalId?: string | null
  },
) {
  const acct = await db
    .select({ id: financeAccounts.id })
    .from(financeAccounts)
    .where(
      and(
        eq(financeAccounts.id, input.accountId),
        eq(financeAccounts.businessId, businessId),
        isNull(financeAccounts.archivedAt),
      ),
    )
    .limit(1)
  if (!acct[0]) {
    throw Object.assign(new Error('account_not_found'), { statusCode: 404 })
  }

  const [row] = await db
    .insert(financeTransactions)
    .values({
      businessId,
      accountId: input.accountId,
      bookedOn: input.bookedOn,
      name: input.name,
      description: input.description ?? '',
      category: input.category ?? 'Sonstiges',
      projectLabel: input.projectLabel ?? null,
      contactId: input.contactId ?? null,
      status: input.status ?? 'paid',
      kind: input.kind,
      source: input.source ?? 'manual',
      amountCents: input.amountCents,
      recurring: input.recurring ?? false,
      externalId: input.externalId ?? null,
    })
    .returning()
  return txToClient(row!)
}

export async function patchTransaction(
  businessId: string,
  id: string,
  input: Partial<{
    bookedOn: string
    name: string
    description: string
    category: string
    projectLabel: string | null
    contactId: string | null
    status: string
    kind: 'income' | 'expense'
    source: string
    amountCents: number
    recurring: boolean
    externalId: string | null
  }>,
) {
  const [row] = await db
    .update(financeTransactions)
    .set({
      ...(input.bookedOn !== undefined ? { bookedOn: input.bookedOn } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.projectLabel !== undefined ? { projectLabel: input.projectLabel } : {}),
      ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.amountCents !== undefined ? { amountCents: input.amountCents } : {}),
      ...(input.recurring !== undefined ? { recurring: input.recurring } : {}),
      ...(input.externalId !== undefined ? { externalId: input.externalId } : {}),
      updatedAt: sql`now()`,
    })
    .where(
      and(eq(financeTransactions.id, id), eq(financeTransactions.businessId, businessId)),
    )
    .returning()
  return row ? txToClient(row) : null
}

export async function deleteTransaction(businessId: string, id: string) {
  const [row] = await db
    .delete(financeTransactions)
    .where(
      and(eq(financeTransactions.id, id), eq(financeTransactions.businessId, businessId)),
    )
    .returning({ id: financeTransactions.id })
  return Boolean(row)
}

export async function upsertSettings(
  businessId: string,
  input: {
    taxReserveCents?: number
    opsBufferCurrentCents?: number
    opsBufferTargetCents?: number
  },
) {
  const existing = await db
    .select()
    .from(financeSettings)
    .where(eq(financeSettings.businessId, businessId))
    .limit(1)
  if (!existing[0]) {
    const [row] = await db
      .insert(financeSettings)
      .values({
        businessId,
        taxReserveCents: input.taxReserveCents ?? 0,
        opsBufferCurrentCents: input.opsBufferCurrentCents ?? 0,
        opsBufferTargetCents: input.opsBufferTargetCents ?? 0,
      })
      .returning()
    return row!
  }
  const [row] = await db
    .update(financeSettings)
    .set({
      ...(input.taxReserveCents !== undefined
        ? { taxReserveCents: input.taxReserveCents }
        : {}),
      ...(input.opsBufferCurrentCents !== undefined
        ? { opsBufferCurrentCents: input.opsBufferCurrentCents }
        : {}),
      ...(input.opsBufferTargetCents !== undefined
        ? { opsBufferTargetCents: input.opsBufferTargetCents }
        : {}),
      updatedAt: sql`now()`,
    })
    .where(eq(financeSettings.businessId, businessId))
    .returning()
  return row!
}
