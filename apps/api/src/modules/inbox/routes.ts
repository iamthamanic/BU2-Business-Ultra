/**
 * Omnichannel Inbox HTTP — Telegram E2E (list / sync / reply).
 * Location: apps/api/src/modules/inbox/routes.ts
 */
import type { FastifyInstance } from 'fastify'
import {
  ConnectTelegramSchema,
  FinalizeUnipileTelegramSchema,
  InboxReplySchema,
  LinkUnipileTelegramSchema,
  canManageCredentials,
  canMutateContent,
} from '@bu2/shared'
import {
  connectTelegramBot,
  getConversationForBusiness,
  getIdentityContext,
  listConversationMessages,
  listInboxConversations,
  listTelegramConnections,
  replyInConversation,
  syncTelegramConnection,
} from '../../lib/integrations/telegram/inboxSync.js'
import { ensureTelegramAdapterRegistered } from '../../lib/integrations/telegram/adapter.js'
import {
  finalizeUnipileTelegramQr,
  isUnipileConfigured,
  linkUnipileTelegramAccount,
  startUnipileTelegramQr,
  syncUnipileConnection,
} from '../../lib/integrations/unipile/inboxSync.js'
import { ensureUnipileAdapterRegistered } from '../../lib/integrations/unipile/adapter.js'
import { syncGmailConnection } from '../../lib/integrations/gmail/inboxSync.js'
import { httpError } from '../../lib/httpError.js'
import { loadMembership, requireUser } from '../../plugins/auth.js'

ensureTelegramAdapterRegistered()
ensureUnipileAdapterRegistered()

export async function inboxRoutes(app: FastifyInstance) {
  app.get('/api/b/:slug/inbox/connections', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(403).send({ error: 'forbidden' })
    const connections = await listTelegramConnections(m.businessId)
    return { connections }
  })

  app.post('/api/b/:slug/inbox/telegram/connect', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || (!canManageCredentials(m.role) && !user.isSuperadmin)) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    const body = ConnectTelegramSchema.safeParse(req.body)
    if (!body.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: body.error.issues })
    }
    try {
      const connection = await connectTelegramBot({
        businessId: m.businessId,
        userId: user.id,
        botToken: body.data.botToken,
        displayName: body.data.displayName,
      })
      return reply.code(201).send({ connection })
    } catch (e) {
      const { status, error } = httpError(e)
      return reply.code(status).send({ error })
    }
  })

  app.post('/api/b/:slug/inbox/telegram/connections/:id/sync', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || (!canMutateContent(m.role) && !user.isSuperadmin)) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    try {
      const result = await syncTelegramConnection(m.businessId, id)
      return { result }
    } catch (e) {
      const { status, error } = httpError(e)
      return reply.code(status).send({ error })
    }
  })

  app.post('/api/b/:slug/inbox/google/connections/:id/sync', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || (!canMutateContent(m.role) && !user.isSuperadmin)) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    try {
      const result = await syncGmailConnection(m.businessId, id)
      return { result }
    } catch (e) {
      const { status, error } = httpError(e)
      return reply.code(status).send({ error })
    }
  })

  app.get('/api/b/:slug/inbox/unipile/status', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m && !user.isSuperadmin) return reply.code(403).send({ error: 'forbidden' })
    return { configured: isUnipileConfigured() }
  })

  app.post('/api/b/:slug/inbox/unipile/telegram/start', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || (!canManageCredentials(m.role) && !user.isSuperadmin)) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    try {
      const started = await startUnipileTelegramQr()
      return {
        accountId: started.accountId,
        qrCodeString: started.qrCodeString,
      }
    } catch (e) {
      const { status, error } = httpError(e)
      return reply.code(status).send({ error })
    }
  })

  app.post('/api/b/:slug/inbox/unipile/telegram/finalize', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || (!canManageCredentials(m.role) && !user.isSuperadmin)) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    const body = FinalizeUnipileTelegramSchema.safeParse(req.body)
    if (!body.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: body.error.issues })
    }
    try {
      const result = await finalizeUnipileTelegramQr({
        businessId: m.businessId,
        userId: user.id,
        accountId: body.data.accountId,
        displayName: body.data.displayName,
      })
      return result
    } catch (e) {
      const { status, error } = httpError(e)
      return reply.code(status).send({ error })
    }
  })

  app.post('/api/b/:slug/inbox/unipile/telegram/link', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m || (!canManageCredentials(m.role) && !user.isSuperadmin)) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    const body = LinkUnipileTelegramSchema.safeParse(req.body)
    if (!body.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: body.error.issues })
    }
    try {
      const connection = await linkUnipileTelegramAccount({
        businessId: m.businessId,
        userId: user.id,
        accountId: body.data.accountId,
        displayName: body.data.displayName,
      })
      return reply.code(201).send({ connection })
    } catch (e) {
      const { status, error } = httpError(e)
      return reply.code(status).send({ error })
    }
  })

  app.post('/api/b/:slug/inbox/unipile/connections/:id/sync', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || (!canMutateContent(m.role) && !user.isSuperadmin)) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    try {
      const result = await syncUnipileConnection(m.businessId, id)
      return { result }
    } catch (e) {
      const { status, error } = httpError(e)
      return reply.code(status).send({ error })
    }
  })

  app.get('/api/b/:slug/inbox/conversations', async (req, reply) => {
    const user = await requireUser(req)
    const { slug } = req.params as { slug: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(403).send({ error: 'forbidden' })
    const conversations = await listInboxConversations(m.businessId)
    return { conversations }
  })

  app.get('/api/b/:slug/inbox/conversations/:id', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m) return reply.code(403).send({ error: 'forbidden' })
    const data = await listConversationMessages(m.businessId, id)
    if (!data) return reply.code(404).send({ error: 'not_found' })
    const identity = await getIdentityContext(m.businessId, data.conversation.contactIdentityId)
    return { ...data, identity }
  })

  app.post('/api/b/:slug/inbox/conversations/:id/reply', async (req, reply) => {
    const user = await requireUser(req)
    const { slug, id } = req.params as { slug: string; id: string }
    const m = await loadMembership(user.id, slug)
    if (!m || (!canMutateContent(m.role) && !user.isSuperadmin)) {
      return reply.code(403).send({ error: 'forbidden' })
    }
    const body = InboxReplySchema.safeParse(req.body)
    if (!body.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: body.error.issues })
    }
    const conv = await getConversationForBusiness(m.businessId, id)
    if (!conv) return reply.code(404).send({ error: 'not_found' })
    try {
      const message = await replyInConversation({
        businessId: m.businessId,
        conversationId: id,
        body: body.data.body,
        userId: user.id,
      })
      return {
        message: {
          id: message.id,
          direction: message.direction,
          body: message.bodyText,
          deliveryStatus: message.deliveryStatus,
          errorDetail: message.errorDetail,
          sentAt: message.sentAt,
          createdAt: message.createdAt,
        },
      }
    } catch (e) {
      const { status, error } = httpError(e)
      return reply.code(status).send({ error })
    }
  })
}
