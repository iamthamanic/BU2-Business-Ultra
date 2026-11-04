/**
 * Unipile Telegram-user inbox — connect (QR/link), sync chats, reply/outbox.
 * Location: apps/api/src/lib/integrations/unipile/inboxSync.ts
 */
import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import {
  connectionCredentials,
  connections,
  contactIdentities,
  conversations,
  messages,
  moduleBindings,
  outboxJobs,
  syncCursors,
} from '../../../db/schema.js'
import { keyHint, sealSecret } from '../../crypto.js'
import { parseCapabilitiesCache, purposeAllowed } from '../core/capabilities.js'
import { ensureUnipileAdapterRegistered, unipileAdapter } from './adapter.js'
import {
  getUnipileConfig,
  requireUnipileConfig,
  unipileGetAccount,
  unipileListChats,
  unipileListMessages,
  unipileSendMessage,
  unipileStartTelegram,
} from './client.js'

ensureUnipileAdapterRegistered()

const STREAM = 'unipile:chats'
const CHANNEL = 'telegram_user'

function previewOf(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > 140 ? `${t.slice(0, 137)}…` : t
}

async function ensureInboxBindings(businessId: string, connectionId: string) {
  for (const purpose of ['read_dm', 'send_dm', 'sync'] as const) {
    const existing = await db
      .select()
      .from(moduleBindings)
      .where(
        and(
          eq(moduleBindings.connectionId, connectionId),
          eq(moduleBindings.module, 'inbox'),
          eq(moduleBindings.purpose, purpose),
        ),
      )
      .limit(1)
    if (existing[0]) continue
    await db.insert(moduleBindings).values({
      businessId,
      connectionId,
      module: 'inbox',
      purpose,
      enabled: true,
    })
  }
}

async function upsertIdentity(businessId: string, value: string, displayName: string) {
  const existing = await db
    .select()
    .from(contactIdentities)
    .where(
      and(
        eq(contactIdentities.businessId, businessId),
        eq(contactIdentities.kind, 'telegram_user'),
        eq(contactIdentities.value, value),
      ),
    )
    .limit(1)
  if (existing[0]) {
    if (displayName && existing[0].displayName !== displayName) {
      await db
        .update(contactIdentities)
        .set({ displayName, updatedAt: new Date() })
        .where(eq(contactIdentities.id, existing[0].id))
    }
    return existing[0].id
  }
  const rows = await db
    .insert(contactIdentities)
    .values({
      businessId,
      kind: 'telegram_user',
      value,
      displayName,
      confidence: 'medium',
    })
    .returning()
  return rows[0]!.id
}

async function upsertConversation(opts: {
  businessId: string
  connectionId: string
  chatId: string
  title: string
  identityId: string
  preview: string
  at: Date
}) {
  const existing = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.connectionId, opts.connectionId),
        eq(conversations.externalThreadId, opts.chatId),
      ),
    )
    .limit(1)
  if (existing[0]) {
    await db
      .update(conversations)
      .set({
        title: opts.title,
        contactIdentityId: opts.identityId,
        lastMessageAt: opts.at,
        lastPreview: opts.preview,
        status: 'open',
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, existing[0].id))
    return existing[0].id
  }
  const rows = await db
    .insert(conversations)
    .values({
      businessId: opts.businessId,
      connectionId: opts.connectionId,
      channel: CHANNEL,
      externalThreadId: opts.chatId,
      title: opts.title,
      contactIdentityId: opts.identityId,
      lastMessageAt: opts.at,
      lastPreview: opts.preview,
      status: 'open',
    })
    .returning()
  return rows[0]!.id
}

async function insertMessage(opts: {
  businessId: string
  connectionId: string
  conversationId: string
  providerMessageId: string
  body: string
  direction: 'inbound' | 'outbound'
  deliveryStatus: 'received' | 'sent'
  at: Date
  raw: Record<string, unknown>
}) {
  try {
    await db.insert(messages).values({
      businessId: opts.businessId,
      connectionId: opts.connectionId,
      conversationId: opts.conversationId,
      direction: opts.direction,
      providerMessageId: opts.providerMessageId,
      bodyText: opts.body,
      deliveryStatus: opts.deliveryStatus,
      sentAt: opts.at,
      raw: opts.raw,
    })
    return true
  } catch (e) {
    const msg = String(e)
    if (msg.includes('messages_conn_provider_msg_uidx') || msg.includes('unique')) return false
    throw e
  }
}

async function persistConnection(opts: {
  businessId: string
  userId: string
  accountId: string
  displayName?: string
}) {
  const result = await unipileAdapter.connect({
    externalAccountId: opts.accountId,
    displayName: opts.displayName,
    credential: opts.accountId,
    accountType: 'telegram_user',
  })

  try {
    const inserted = await db
      .insert(connections)
      .values({
        businessId: opts.businessId,
        provider: result.provider,
        authMethod: result.authMethod,
        externalAccountId: result.externalAccountId,
        displayName: result.displayName,
        status: 'active',
        accountType: result.accountType,
        health: result.health,
        capabilitiesCache: result.capabilities,
        createdByUserId: opts.userId,
      })
      .returning()
    const conn = inserted[0]
    if (!conn) throw new Error('insert_failed')

    for (const cred of result.credentials) {
      const sealed = sealSecret(cred.plaintext)
      await db.insert(connectionCredentials).values({
        connectionId: conn.id,
        kind: cred.kind,
        ciphertext: sealed.ciphertext,
        iv: sealed.iv,
        tag: sealed.tag,
        keyHint: keyHint(cred.plaintext),
      })
    }

    await ensureInboxBindings(opts.businessId, conn.id)
    return conn
  } catch (e) {
    const msg = String(e)
    if (msg.includes('connections_biz_provider_ext_uidx') || msg.includes('unique')) {
      throw Object.assign(new Error('connection_exists'), { statusCode: 409 })
    }
    throw e
  }
}

/** Start Telegram QR auth on Unipile (platform credentials). */
export async function startUnipileTelegramQr() {
  const cfg = requireUnipileConfig()
  return unipileStartTelegram(cfg)
}

export function isUnipileConfigured(): boolean {
  return Boolean(getUnipileConfig())
}

/** After QR scan — poll until connected, then create BU2 connection. */
export async function finalizeUnipileTelegramQr(opts: {
  businessId: string
  userId: string
  accountId: string
  displayName?: string
}) {
  const cfg = requireUnipileConfig()
  const status = await unipileGetAccount(cfg, opts.accountId)
  if (status.state === 'pending') {
    return { status: 'pending' as const }
  }
  if (status.state === 'failed') {
    throw Object.assign(new Error(`unipile_${status.reason}`), { statusCode: 409 })
  }
  const conn = await persistConnection({
    businessId: opts.businessId,
    userId: opts.userId,
    accountId: opts.accountId,
    displayName: opts.displayName,
  })
  return {
    status: 'connected' as const,
    connection: {
      id: conn.id,
      provider: conn.provider,
      displayName: conn.displayName,
      externalAccountId: conn.externalAccountId,
      status: conn.status,
      accountType: conn.accountType,
    },
  }
}

/** Link an already-connected Unipile account id (dashboard / prior QR). */
export async function linkUnipileTelegramAccount(opts: {
  businessId: string
  userId: string
  accountId: string
  displayName?: string
}) {
  requireUnipileConfig()
  const conn = await persistConnection(opts)
  return {
    id: conn.id,
    provider: conn.provider,
    displayName: conn.displayName,
    externalAccountId: conn.externalAccountId,
    status: conn.status,
    accountType: conn.accountType,
  }
}

export async function syncUnipileConnection(businessId: string, connectionId: string) {
  const cfg = requireUnipileConfig()
  const rows = await db
    .select()
    .from(connections)
    .where(and(eq(connections.id, connectionId), eq(connections.businessId, businessId)))
    .limit(1)
  const conn = rows[0]
  if (!conn) throw Object.assign(new Error('connection_not_found'), { statusCode: 404 })
  if (conn.provider !== 'unipile') {
    throw Object.assign(new Error('not_unipile_connection'), { statusCode: 400 })
  }
  const allowed = purposeAllowed(parseCapabilitiesCache(conn.capabilitiesCache), 'sync')
  if (!allowed.allowed) {
    throw Object.assign(new Error(allowed.reason || 'capability_denied'), { statusCode: 409 })
  }

  const accountId = conn.externalAccountId
  const chats = await unipileListChats(cfg, accountId, 40)
  let imported = 0

  for (const chat of chats) {
    if (!chat.id) continue
    const title = (chat.name || chat.provider_id || chat.id).slice(0, 200)
    const identityId = await upsertIdentity(businessId, `chat:${chat.id}`, title)
    const msgs = await unipileListMessages(cfg, chat.id, 25)
    // API returns newest first — reverse for chronological ingest
    const ordered = [...msgs].reverse()
    let lastPreview = ''
    let lastAt = chat.timestamp ? new Date(chat.timestamp) : new Date()

    for (const m of ordered) {
      const text = String(m.text || m.body || '').trim()
      if (!text) continue
      const at = new Date(m.timestamp || m.date || Date.now())
      if (!Number.isNaN(at.getTime())) lastAt = at
      lastPreview = previewOf(text)
      const conversationId = await upsertConversation({
        businessId,
        connectionId,
        chatId: chat.id,
        title,
        identityId,
        preview: lastPreview,
        at: lastAt,
      })
      const isOut = Boolean(m.is_sender)
      const ok = await insertMessage({
        businessId,
        connectionId,
        conversationId,
        providerMessageId: `unipile:${chat.id}:${m.id}`,
        body: text,
        direction: isOut ? 'outbound' : 'inbound',
        deliveryStatus: isOut ? 'sent' : 'received',
        at,
        raw: m as unknown as Record<string, unknown>,
      })
      if (ok) imported++
    }

    if (!ordered.length) {
      await upsertConversation({
        businessId,
        connectionId,
        chatId: chat.id,
        title,
        identityId,
        preview: lastPreview || title,
        at: lastAt,
      })
    }
  }

  const cursorRows = await db
    .select()
    .from(syncCursors)
    .where(and(eq(syncCursors.connectionId, connectionId), eq(syncCursors.stream, STREAM)))
    .limit(1)
  const nextCursor = new Date().toISOString()
  if (cursorRows[0]) {
    await db
      .update(syncCursors)
      .set({ cursor: nextCursor, renewedAt: new Date(), updatedAt: new Date() })
      .where(eq(syncCursors.id, cursorRows[0].id))
  } else {
    await db.insert(syncCursors).values({
      connectionId,
      stream: STREAM,
      cursor: nextCursor,
      renewedAt: new Date(),
    })
  }

  return { imported, chats: chats.length, cursor: nextCursor }
}

async function processUnipileOutboxJob(jobId: string) {
  const jobs = await db.select().from(outboxJobs).where(eq(outboxJobs.id, jobId)).limit(1)
  const job = jobs[0]
  if (!job) return
  if (job.status !== 'pending' && job.status !== 'processing') return

  await db
    .update(outboxJobs)
    .set({ status: 'processing', attempts: job.attempts + 1, updatedAt: new Date() })
    .where(eq(outboxJobs.id, jobId))

  const payload = job.payload as {
    messageId?: string
    chatId?: string
    text?: string
  }
  try {
    const cfg = requireUnipileConfig()
    if (!payload.chatId || !payload.text || !payload.messageId) {
      throw new Error('invalid_payload')
    }
    const sent = await unipileSendMessage(cfg, payload.chatId, payload.text)
    const providerRef = String(sent.id || sent.message_id || `unipile-out:${payload.messageId}`)
    await db
      .update(messages)
      .set({
        deliveryStatus: 'sent',
        providerMessageId: providerRef,
        sentAt: new Date(),
        errorDetail: null,
      })
      .where(eq(messages.id, payload.messageId))
    await db
      .update(outboxJobs)
      .set({
        status: 'sent',
        providerRef,
        updatedAt: new Date(),
      })
      .where(eq(outboxJobs.id, jobId))
  } catch (e) {
    const detail = String((e as Error).message || e).slice(0, 500)
    if (payload.messageId) {
      await db
        .update(messages)
        .set({
          deliveryStatus: 'failed',
          errorDetail: detail,
        })
        .where(eq(messages.id, payload.messageId))
    }
    await db
      .update(outboxJobs)
      .set({
        status: 'failed',
        lastError: detail,
        updatedAt: new Date(),
      })
      .where(eq(outboxJobs.id, jobId))
  }
}

export async function replyUnipileConversation(opts: {
  businessId: string
  conversationId: string
  connectionId: string
  chatId: string
  body: string
  userId: string
}) {
  const messageId = randomUUID()
  const provisionalProviderId = `pending:${messageId}`
  await db.insert(messages).values({
    id: messageId,
    businessId: opts.businessId,
    conversationId: opts.conversationId,
    connectionId: opts.connectionId,
    direction: 'outbound',
    providerMessageId: provisionalProviderId,
    bodyText: opts.body,
    deliveryStatus: 'pending',
    raw: { byUserId: opts.userId },
  })

  await db
    .update(conversations)
    .set({
      lastMessageAt: new Date(),
      lastPreview: previewOf(opts.body),
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, opts.conversationId))

  const jobs = await db
    .insert(outboxJobs)
    .values({
      businessId: opts.businessId,
      connectionId: opts.connectionId,
      kind: 'unipile_send',
      payload: {
        messageId,
        conversationId: opts.conversationId,
        chatId: opts.chatId,
        text: opts.body,
      },
      status: 'pending',
    })
    .returning()

  const job = jobs[0]
  if (job) await processUnipileOutboxJob(job.id)

  const msgRows = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1)
  return msgRows[0]!
}
