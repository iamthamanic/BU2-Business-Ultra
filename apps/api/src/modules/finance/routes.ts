/**
 * Finance API — snapshot + account/transaction CRUD.
 * Location: apps/api/src/modules/finance/routes.ts
 */
import type { FastifyInstance } from 'fastify'
import {
  FinanceAccountCreateSchema,
  FinanceAccountPatchSchema,
  FinancePeriodSchema,
  FinanceSettingsPatchSchema,
  FinanceTransactionCreateSchema,
  FinanceTransactionPatchSchema,
  canMutateContent,
} from '@bu2/shared'
import { writeAudit } from '../../lib/audit.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'
import {
  archiveAccount,
  buildSnapshot,
  createAccount,
  createTransaction,
  deleteTransaction,
  listAccounts,
  listTransactions,
  patchAccount,
  patchTransaction,
  txToClient,
  upsertSettings,
} from './service.js'

export async function financeRoutes(app: FastifyInstance) {
  app.get('/api/b/:slug/finance/snapshot', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const q = (req.query as { period?: string }) || {}
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const periodParse = FinancePeriodSchema.safeParse(q.period ?? 'current')
    const period = periodParse.success ? periodParse.data : 'current'
    const snapshot = await buildSnapshot(m.businessId, period)
    return { snapshot }
  })

  app.get('/api/b/:slug/finance/accounts', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    return { accounts: await listAccounts(m.businessId) }
  })

  app.post('/api/b/:slug/finance/accounts', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
    if (m.status === 'archived') return reply.code(409).send({ error: 'business_archived' })
    const body = FinanceAccountCreateSchema.parse(req.body)
    const account = await createAccount(m.businessId, body)
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'finance.account_created',
      resourceRef: `finance_account:${account.id}`,
      meta: { name: account.name },
    })
    return reply.code(201).send({ account })
  })

  app.patch('/api/b/:slug/finance/accounts/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
    if (m.status === 'archived') return reply.code(409).send({ error: 'business_archived' })
    const body = FinanceAccountPatchSchema.parse(req.body)
    const account = await patchAccount(m.businessId, id, body)
    if (!account) return reply.code(404).send({ error: 'not_found' })
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'finance.account_updated',
      resourceRef: `finance_account:${account.id}`,
    })
    return { account }
  })

  app.post('/api/b/:slug/finance/accounts/:id/archive', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
    const account = await archiveAccount(m.businessId, id)
    if (!account) return reply.code(404).send({ error: 'not_found' })
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'finance.account_archived',
      resourceRef: `finance_account:${account.id}`,
    })
    return { account }
  })

  app.get('/api/b/:slug/finance/transactions', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const q = (req.query as { from?: string; to?: string; limit?: string }) || {}
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(404).send({ error: 'not_found' })
    const limit = q.limit ? Math.min(Number(q.limit) || 200, 1000) : 200
    const rows = await listTransactions(m.businessId, {
      from: q.from,
      to: q.to,
      limit,
    })
    return { transactions: rows.map(txToClient) }
  })

  app.post('/api/b/:slug/finance/transactions', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
    if (m.status === 'archived') return reply.code(409).send({ error: 'business_archived' })
    const body = FinanceTransactionCreateSchema.parse(req.body)
    try {
      const transaction = await createTransaction(m.businessId, body)
      await writeAudit({
        businessId: m.businessId,
        actorUserId: user.id,
        action: 'finance.tx_created',
        resourceRef: `finance_transaction:${transaction.id}`,
        meta: { kind: transaction.kind, amount: transaction.amount },
      })
      return reply.code(201).send({ transaction })
    } catch (err) {
      const e = err as Error & { statusCode?: number }
      if (e.statusCode === 404) return reply.code(404).send({ error: e.message })
      throw err
    }
  })

  app.patch('/api/b/:slug/finance/transactions/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
    if (m.status === 'archived') return reply.code(409).send({ error: 'business_archived' })
    const body = FinanceTransactionPatchSchema.parse(req.body)
    const transaction = await patchTransaction(m.businessId, id, body)
    if (!transaction) return reply.code(404).send({ error: 'not_found' })
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'finance.tx_updated',
      resourceRef: `finance_transaction:${transaction.id}`,
    })
    return { transaction }
  })

  app.delete('/api/b/:slug/finance/transactions/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
    const ok = await deleteTransaction(m.businessId, id)
    if (!ok) return reply.code(404).send({ error: 'not_found' })
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'finance.tx_deleted',
      resourceRef: `finance_transaction:${id}`,
    })
    return { ok: true }
  })

  app.patch('/api/b/:slug/finance/settings', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || !canMutateContent(m)) return reply.code(403).send({ error: 'forbidden' })
    if (m.status === 'archived') return reply.code(409).send({ error: 'business_archived' })
    const body = FinanceSettingsPatchSchema.parse(req.body)
    const settings = await upsertSettings(m.businessId, body)
    await writeAudit({
      businessId: m.businessId,
      actorUserId: user.id,
      action: 'finance.settings_updated',
      resourceRef: `finance_settings:${m.businessId}`,
    })
    return {
      settings: {
        taxReserveCents: settings.taxReserveCents,
        opsBufferCurrentCents: settings.opsBufferCurrentCents,
        opsBufferTargetCents: settings.opsBufferTargetCents,
        updatedAt: settings.updatedAt.toISOString(),
      },
    }
  })
}
