/**
 * Telegram inbox sync + reply/outbox — tenant-scoped.
 * Location: apps/api/src/lib/integrations/telegram/inboxSync.ts
 */
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { InboxReplyInput } from '@bu2/shared'
import { db } from '../../../db/client.js'
import {
  connectionCredentials,
  connections,
  contactIdentities,
  conversations,
  customers,
  memberships,
  messages,
  moduleBindings,
  outboxJobs,
  syncCursors,
  users,
} from '../../../db/schema.js'
import { loadEnv } from '../../env.js'
import { keyHint, openSecret, sealSecret } from '../../crypto.js'
import { purposeAllowed, parseCapabilitiesCache } from '../core/capabilities.js'
import { composerFormatsForConnection } from '../inbox/composerFormats.js'
import { bumpConversationUnread, markConversationRead } from '../inbox/unread.js'
import { ensureTelegramAdapterRegistered, telegramAdapter } from './adapter.js'
import {
  displayNameFromUser,
  telegramGetUpdates,
  telegramSendMedia,
  telegramSendMessage,
  type TelegramMediaKind,
  type TelegramMessage,
  type TelegramUpdate,
} from './api.js'

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024

ensureTelegramAdapterRegistered()

const STREAM = 'telegram:updates'

function previewOf(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length > 280 ? `${t.slice(0, 277)}…` : t
}

async function loadBotToken(businessId: string, connectionId: string): Promise<string> {
  const connRows = await db
    .select()
    .from(connections)
    .where(and(eq(connections.id, connectionId), eq(connections.businessId, businessId)))
    .limit(1)
  const conn = connRows[0]
  if (!conn || conn.provider !== 'telegram') {
    throw Object.assign(new Error('connection_not_found'), { statusCode: 404 })
  }
  if (conn.status !== 'active') {
    throw Object.assign(new Error('connection_inactive'), { statusCode: 409 })
  }
  const creds = await db
    .select()
    .from(connectionCredentials)
    .where(
      and(
        eq(connectionCredentials.connectionId, connectionId),
        eq(connectionCredentials.kind, 'bot_token'),
      ),
    )
    .limit(1)
  const row = creds[0]
  if (!row) throw Object.assign(new Error('credential_missing'), { statusCode: 409 })
  return openSecret(row.ciphertext, row.iv, row.tag)
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

export async function connectTelegramBot(opts: {
  businessId: string
  userId: string
  botToken: string
  displayName?: string
}) {
  const result = await telegramAdapter.connect({
    externalAccountId: 'pending',
    credential: opts.botToken,
    displayName: opts.displayName,
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
    return {
      id: conn.id,
      businessId: conn.businessId,
      provider: conn.provider,
      authMethod: conn.authMethod,
      externalAccountId: conn.externalAccountId,
      displayName: conn.displayName,
      status: conn.status,
      accountType: conn.accountType,
      health: conn.health as Record<string, unknown>,
      capabilities: parseCapabilitiesCache(conn.capabilitiesCache),
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
    }
  } catch (e) {
    const msg = String(e)
    if (msg.includes('connections_biz_provider_ext_uidx') || msg.includes('unique')) {
      throw Object.assign(new Error('connection_exists'), { statusCode: 409 })
    }
    throw e
  }
}

async function upsertIdentity(
  businessId: string,
  telegramUserId: string,
  displayName: string,
) {
  const existing = await db
    .select()
    .from(contactIdentities)
    .where(
      and(
        eq(contactIdentities.businessId, businessId),
        eq(contactIdentities.kind, 'telegram_user'),
        eq(contactIdentities.value, telegramUserId),
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
      value: telegramUserId,
      displayName,
      confidence: 'high',
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
      channel: 'telegram',
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

async function insertInboundMessage(opts: {
  businessId: string
  connectionId: string
  conversationId: string
  providerMessageId: string
  body: string
  at: Date
  raw: Record<string, unknown>
}) {
  try {
    await db.insert(messages).values({
      businessId: opts.businessId,
      connectionId: opts.connectionId,
      conversationId: opts.conversationId,
      direction: 'inbound',
      providerMessageId: opts.providerMessageId,
      bodyText: opts.body,
      deliveryStatus: 'received',
      sentAt: opts.at,
      raw: opts.raw,
    })
    await bumpConversationUnread(opts.conversationId, opts.businessId)
    return true
  } catch (e) {
    const msg = String(e)
    if (msg.includes('messages_conn_provider_msg_uidx') || msg.includes('unique')) {
      return false
    }
    throw e
  }
}

function extractMessage(u: TelegramUpdate): TelegramMessage | null {
  return u.message || u.edited_message || null
}

export async function syncTelegramConnection(businessId: string, connectionId: string) {
  const capsRow = await db
    .select()
    .from(connections)
    .where(and(eq(connections.id, connectionId), eq(connections.businessId, businessId)))
    .limit(1)
  const conn = capsRow[0]
  if (!conn) throw Object.assign(new Error('connection_not_found'), { statusCode: 404 })
  const allowed = purposeAllowed(parseCapabilitiesCache(conn.capabilitiesCache), 'sync')
  if (!allowed.allowed) {
    throw Object.assign(new Error(allowed.reason || 'capability_denied'), { statusCode: 409 })
  }

  const token = await loadBotToken(businessId, connectionId)
  const cursorRows = await db
    .select()
    .from(syncCursors)
    .where(and(eq(syncCursors.connectionId, connectionId), eq(syncCursors.stream, STREAM)))
    .limit(1)
  const offset = cursorRows[0]?.cursor ? Number(cursorRows[0].cursor) : undefined
  const updates = await telegramGetUpdates(token, {
    offset: Number.isFinite(offset) ? offset : undefined,
    limit: 50,
    timeout: 0,
  })

  let imported = 0
  let maxUpdateId = offset && Number.isFinite(offset) ? offset - 1 : 0

  for (const upd of updates) {
    if (upd.update_id > maxUpdateId) maxUpdateId = upd.update_id
    const msg = extractMessage(upd)
    if (!msg?.chat?.id) continue
    const text = (msg.text || msg.caption || '').trim()
    if (!text) continue
    const chatId = String(msg.chat.id)
    const fromId = String(msg.from?.id || msg.chat.id)
    const title = displayNameFromUser(msg.from, msg.chat)
    const at = new Date((msg.date || 0) * 1000)
    const identityId = await upsertIdentity(businessId, fromId, title)
    const conversationId = await upsertConversation({
      businessId,
      connectionId,
      chatId,
      title,
      identityId,
      preview: previewOf(text),
      at,
    })
    const providerMessageId = `tg:${chatId}:${msg.message_id}`
    const ok = await insertInboundMessage({
      businessId,
      connectionId,
      conversationId,
      providerMessageId,
      body: text,
      at,
      raw: { update_id: upd.update_id, message: msg },
    })
    if (ok) imported++
  }

  const nextCursor = String(maxUpdateId + 1)
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

  return { imported, updates: updates.length, cursor: nextCursor }
}

export async function listInboxConversations(businessId: string) {
  const rows = await db
    .select({
      id: conversations.id,
      channel: conversations.channel,
      connectionId: conversations.connectionId,
      title: conversations.title,
      status: conversations.status,
      lastMessageAt: conversations.lastMessageAt,
      lastPreview: conversations.lastPreview,
      contactIdentityId: conversations.contactIdentityId,
      externalThreadId: conversations.externalThreadId,
      assigneeUserId: conversations.assigneeUserId,
      unreadCount: conversations.unreadCount,
      connectionDisplayName: connections.displayName,
      connectionProvider: connections.provider,
      identityKind: contactIdentities.kind,
      identityValue: contactIdentities.value,
      identityDisplayName: contactIdentities.displayName,
      customerId: contactIdentities.customerId,
      assigneeDisplayName: users.displayName,
      assigneeEmail: users.email,
    })
    .from(conversations)
    .leftJoin(connections, eq(connections.id, conversations.connectionId))
    .leftJoin(contactIdentities, eq(contactIdentities.id, conversations.contactIdentityId))
    .leftJoin(users, eq(users.id, conversations.assigneeUserId))
    .where(eq(conversations.businessId, businessId))
    .orderBy(desc(conversations.lastMessageAt), desc(conversations.updatedAt))
  return rows.map((r) => ({
    id: r.id,
    channel: r.channel,
    connectionId: r.connectionId,
    connectionDisplayName: r.connectionDisplayName,
    connectionProvider: r.connectionProvider,
    title: r.title,
    status: r.status,
    lastMessageAt: r.lastMessageAt,
    lastPreview: r.lastPreview,
    contactIdentityId: r.contactIdentityId,
    externalThreadId: r.externalThreadId,
    assigneeUserId: r.assigneeUserId,
    assigneeDisplayName: r.assigneeDisplayName?.trim() || r.assigneeEmail || null,
    unreadCount: r.unreadCount ?? 0,
    isUnread: (r.unreadCount ?? 0) > 0,
    identityKind: r.identityKind,
    identityValue: r.identityValue,
    identityDisplayName: r.identityDisplayName,
    customerId: r.customerId,
    isExistingCustomer: Boolean(r.customerId),
  }))
}

export async function getConversationForBusiness(businessId: string, conversationId: string) {
  const rows = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.businessId, businessId)))
    .limit(1)
  return rows[0] || null
}

/** Assign / unassign a conversation to a business member (null clears). */
export async function assignConversation(opts: {
  businessId: string
  conversationId: string
  assigneeUserId: string | null
}) {
  const conv = await getConversationForBusiness(opts.businessId, opts.conversationId)
  if (!conv) throw Object.assign(new Error('conversation_not_found'), { statusCode: 404 })
  if (opts.assigneeUserId) {
    const member = await db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(
        and(
          eq(memberships.businessId, opts.businessId),
          eq(memberships.userId, opts.assigneeUserId),
        ),
      )
      .limit(1)
    if (!member[0]) {
      throw Object.assign(new Error('assignee_not_member'), { statusCode: 400 })
    }
  }
  const [row] = await db
    .update(conversations)
    .set({
      assigneeUserId: opts.assigneeUserId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(conversations.id, opts.conversationId),
        eq(conversations.businessId, opts.businessId),
      ),
    )
    .returning()
  return row!
}

function viaAccountLabel(conn: {
  displayName: string | null
  externalAccountId: string | null
  provider: string | null
} | null): string | null {
  if (!conn) return null
  if (conn.displayName?.trim()) return conn.displayName.trim()
  if (conn.externalAccountId?.trim()) return conn.externalAccountId.trim()
  return conn.provider
}

function peerLabel(identity: {
  displayName: string | null
  value: string
  kind: string
} | null): { name: string | null; address: string | null } {
  if (!identity) return { name: null, address: null }
  return {
    name: identity.displayName?.trim() || null,
    address: identity.value?.trim() || null,
  }
}

export async function listConversationMessages(businessId: string, conversationId: string) {
  const conv = await getConversationForBusiness(businessId, conversationId)
  if (!conv) return null
  const connRows = await db
    .select({
      displayName: connections.displayName,
      provider: connections.provider,
      externalAccountId: connections.externalAccountId,
      capabilitiesCache: connections.capabilitiesCache,
    })
    .from(connections)
    .where(eq(connections.id, conv.connectionId))
    .limit(1)
  const conn = connRows[0]
  const viaAccount = viaAccountLabel(conn ?? null)
  const composerFormats = composerFormatsForConnection({
    provider: conn?.provider || conv.channel,
    capabilitiesCache: conn?.capabilitiesCache,
  })

  const identity = conv.contactIdentityId
    ? await getIdentityContext(businessId, conv.contactIdentityId)
    : null
  const peer = peerLabel(identity)

  await markConversationRead(conversationId, businessId)

  const rows = await db
    .select()
    .from(messages)
    .where(
      and(eq(messages.conversationId, conversationId), eq(messages.businessId, businessId)),
    )
    .orderBy(asc(messages.createdAt))

  const actorIds = [
    ...new Set(
      rows
        .map((m) => {
          const raw = m.raw as Record<string, unknown>
          return typeof raw?.byUserId === 'string' ? raw.byUserId : null
        })
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const actorNameById = new Map<string, string>()
  if (actorIds.length) {
    const actorRows = await db
      .select({ id: users.id, displayName: users.displayName, email: users.email })
      .from(users)
      .where(inArray(users.id, actorIds))
    for (const u of actorRows) {
      actorNameById.set(u.id, u.displayName?.trim() || u.email || 'Team')
    }
  }

  return {
    conversation: {
      id: conv.id,
      channel: conv.channel,
      title: conv.title,
      status: conv.status,
      connectionId: conv.connectionId,
      connectionDisplayName: conn?.displayName ?? null,
      connectionProvider: conn?.provider ?? null,
      connectionExternalAccountId: conn?.externalAccountId ?? null,
      contactIdentityId: conv.contactIdentityId,
      externalThreadId: conv.externalThreadId,
      lastMessageAt: conv.lastMessageAt,
      assigneeUserId: conv.assigneeUserId,
      unreadCount: 0,
      composerFormats,
    },
    messages: rows.map((m) => {
      const raw = m.raw as Record<string, unknown>
      const byUserId = typeof raw?.byUserId === 'string' ? raw.byUserId : null
      const actorName =
        (typeof raw?.actorName === 'string' && raw.actorName.trim()) ||
        (byUserId ? actorNameById.get(byUserId) : null) ||
        null
      return {
        id: m.id,
        direction: m.direction,
        body: m.bodyText,
        deliveryStatus: m.deliveryStatus,
        errorDetail: m.errorDetail,
        sentAt: m.sentAt,
        createdAt: m.createdAt,
        actorName: m.direction === 'outbound' ? actorName : peer.name,
        actorAddress:
          m.direction === 'outbound' ? viaAccount : peer.address,
        viaAccount: m.direction === 'outbound' ? viaAccount : null,
      }
    }),
  }
}

export async function getIdentityContext(businessId: string, identityId: string | null) {
  if (!identityId) return null
  const rows = await db
    .select()
    .from(contactIdentities)
    .where(and(eq(contactIdentities.id, identityId), eq(contactIdentities.businessId, businessId)))
    .limit(1)
  const r = rows[0]
  if (!r) return null
  let customerName: string | null = null
  let customerKind: string | null = null
  if (r.customerId) {
    const cust = (
      await db
        .select({
          displayName: customers.displayName,
          kind: customers.kind,
        })
        .from(customers)
        .where(and(eq(customers.id, r.customerId), eq(customers.businessId, businessId)))
        .limit(1)
    )[0]
    customerName = cust?.displayName?.trim() || null
    customerKind = cust?.kind || null
  }
  return {
    id: r.id,
    kind: r.kind,
    value: r.value,
    displayName: r.displayName,
    customerId: r.customerId,
    customerName,
    customerKind,
    confidence: r.confidence,
    confirmedAt: r.confirmedAt,
  }
}

async function processTelegramOutboxJob(jobId: string) {
  const jobs = await db.select().from(outboxJobs).where(eq(outboxJobs.id, jobId)).limit(1)
  const job = jobs[0]
  if (!job || job.kind !== 'telegram_send') return
  if (job.status !== 'pending') return

  // Atomic claim — only one worker proceeds (P-06).
  const claimed = await db
    .update(outboxJobs)
    .set({
      status: 'processing',
      attempts: (job.attempts || 0) + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(outboxJobs.id, jobId), eq(outboxJobs.status, 'pending')))
    .returning({ id: outboxJobs.id })
  if (!claimed[0]) return

  const payload = job.payload as {
    messageId?: string
    conversationId?: string
    chatId?: string
    text?: string
    mediaPath?: string
    mediaKind?: TelegramMediaKind
    mediaMime?: string
    mediaFilename?: string
  }
  try {
    const token = await loadBotToken(job.businessId, job.connectionId)
    if (!payload.chatId || !payload.messageId) {
      throw new Error('invalid_payload')
    }
    let sent: TelegramMessage
    if (payload.mediaPath && payload.mediaKind) {
      const bytes = await readFile(payload.mediaPath)
      sent = await telegramSendMedia(token, payload.chatId, {
        kind: payload.mediaKind,
        bytes,
        filename: payload.mediaFilename || 'attachment',
        mime: payload.mediaMime || 'application/octet-stream',
        caption: payload.text,
      })
    } else {
      if (!payload.text) throw new Error('invalid_payload')
      sent = await telegramSendMessage(token, payload.chatId, payload.text)
    }
    const providerMessageId = `tg:${payload.chatId}:${sent.message_id}`
    await db
      .update(messages)
      .set({
        deliveryStatus: 'sent',
        providerMessageId,
        sentAt: new Date(),
        errorDetail: null,
      })
      .where(eq(messages.id, payload.messageId))
    await db
      .update(outboxJobs)
      .set({
        status: 'sent',
        providerRef: providerMessageId,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(outboxJobs.id, jobId))
  } catch (e) {
    const detail = String((e as Error).message || e).slice(0, 500)
    if (payload.messageId) {
      await db
        .update(messages)
        .set({ deliveryStatus: 'failed', errorDetail: detail })
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

function parseDataUrl(dataUrl: string): { mime: string; bytes: Buffer } {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl)
  if (!match) {
    throw Object.assign(new Error('invalid_data_url'), { statusCode: 400 })
  }
  const mime = match[1]!.trim().toLowerCase()
  const bytes = Buffer.from(match[2]!, 'base64')
  if (!bytes.length) {
    throw Object.assign(new Error('empty_attachment'), { statusCode: 400 })
  }
  if (bytes.length > MAX_ATTACHMENT_BYTES) {
    throw Object.assign(new Error('attachment_too_large'), { statusCode: 413 })
  }
  return { mime, bytes }
}

function mediaKindFor(
  format: 'image' | 'file' | 'audio' | 'voice',
  mime: string,
): TelegramMediaKind {
  if (format === 'image' || mime.startsWith('image/')) return 'photo'
  if (format === 'voice') {
    // Browser MediaRecorder is often webm; Bot sendVoice wants ogg — use audio then.
    if (mime.includes('ogg') || mime.includes('opus')) return 'voice'
    return 'audio'
  }
  if (format === 'audio' || mime.startsWith('audio/')) return 'audio'
  return 'document'
}

function safeAttachmentFilename(name: string, mime: string): string {
  const base = name.replace(/[^\w.\-()+ ]+/g, '_').trim().slice(0, 120) || 'attachment'
  if (base.includes('.')) return base
  if (mime.includes('png')) return `${base}.png`
  if (mime.includes('jpeg') || mime.includes('jpg')) return `${base}.jpg`
  if (mime.includes('webp')) return `${base}.webp`
  if (mime.includes('ogg')) return `${base}.ogg`
  if (mime.includes('webm')) return `${base}.webm`
  if (mime.includes('mpeg') || mime.includes('mp3')) return `${base}.mp3`
  if (mime.includes('pdf')) return `${base}.pdf`
  return base
}

export async function replyInConversation(opts: {
  businessId: string
  conversationId: string
  body: string
  userId: string
  attachment?: InboxReplyInput['attachment']
}) {
  const conv = await getConversationForBusiness(opts.businessId, opts.conversationId)
  if (!conv) throw Object.assign(new Error('conversation_not_found'), { statusCode: 404 })

  const connRows = await db
    .select()
    .from(connections)
    .where(and(eq(connections.id, conv.connectionId), eq(connections.businessId, opts.businessId)))
    .limit(1)
  const conn = connRows[0]
  if (!conn) throw Object.assign(new Error('connection_not_found'), { statusCode: 404 })

  const bodyText = (opts.body || '').trim()
  const formats = composerFormatsForConnection({
    provider: conn.provider,
    capabilitiesCache: conn.capabilitiesCache,
  })

  if (opts.attachment && !formats.includes(opts.attachment.format)) {
    throw Object.assign(new Error('format_not_allowed'), { statusCode: 409 })
  }

  if (conn.provider === 'google') {
    if (opts.attachment) {
      throw Object.assign(new Error('media_unsupported_for_provider'), { statusCode: 501 })
    }
    const sendCap = purposeAllowed(parseCapabilitiesCache(conn.capabilitiesCache), 'send_mail')
    if (!sendCap.allowed) {
      throw Object.assign(new Error(sendCap.reason || 'capability_denied'), { statusCode: 409 })
    }
    const { replyGmailConversation } = await import('../gmail/inboxSync.js')
    return replyGmailConversation({
      businessId: opts.businessId,
      conversationId: conv.id,
      connectionId: conv.connectionId,
      threadId: conv.externalThreadId,
      body: bodyText,
      userId: opts.userId,
    })
  }

  const sendCap = purposeAllowed(parseCapabilitiesCache(conn.capabilitiesCache), 'send_dm')
  if (!sendCap.allowed) {
    throw Object.assign(new Error(sendCap.reason || 'capability_denied'), { statusCode: 409 })
  }

  if (conn.provider === 'unipile') {
    if (opts.attachment) {
      throw Object.assign(new Error('media_unsupported_for_provider'), { statusCode: 501 })
    }
    const { replyUnipileConversation } = await import('../unipile/inboxSync.js')
    return replyUnipileConversation({
      businessId: opts.businessId,
      conversationId: conv.id,
      connectionId: conv.connectionId,
      chatId: conv.externalThreadId,
      body: bodyText,
      userId: opts.userId,
    })
  }

  if (conn.provider !== 'telegram') {
    throw Object.assign(new Error('provider_reply_unsupported'), { statusCode: 501 })
  }

  if (!bodyText && !opts.attachment) {
    throw Object.assign(new Error('body_or_attachment_required'), { statusCode: 400 })
  }

  const messageId = randomUUID()
  let mediaPath: string | undefined
  let mediaKind: TelegramMediaKind | undefined
  let mediaMime: string | undefined
  let mediaFilename: string | undefined
  let storedPublic: string | undefined

  if (opts.attachment) {
    const parsed = parseDataUrl(opts.attachment.dataUrl)
    mediaKind = mediaKindFor(opts.attachment.format, parsed.mime)
    mediaMime = parsed.mime
    mediaFilename = safeAttachmentFilename(opts.attachment.filename, parsed.mime)
    const env = loadEnv()
    const dir = join(env.UPLOADS_DIR, opts.businessId, 'inbox')
    await mkdir(dir, { recursive: true })
    const diskName = `${messageId}-${mediaFilename}`
    mediaPath = join(dir, diskName)
    await writeFile(mediaPath, parsed.bytes)
    storedPublic = `/api/media/${opts.businessId}/inbox/${diskName}`
  }

  const provisionalProviderId = `pending:${messageId}`
  const displayBody =
    bodyText ||
    (mediaFilename ? `📎 ${mediaFilename}` : opts.attachment ? '📎 Anhang' : '')

  await db.insert(messages).values({
    id: messageId,
    businessId: opts.businessId,
    conversationId: conv.id,
    connectionId: conv.connectionId,
    direction: 'outbound',
    providerMessageId: provisionalProviderId,
    bodyText: displayBody,
    deliveryStatus: 'pending',
    raw: {
      byUserId: opts.userId,
      attachment: opts.attachment
        ? {
            format: opts.attachment.format,
            filename: mediaFilename,
            mime: mediaMime,
            path: storedPublic,
          }
        : undefined,
    },
  })

  await db
    .update(conversations)
    .set({
      lastMessageAt: new Date(),
      lastPreview: previewOf(displayBody),
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conv.id))

  const jobs = await db
    .insert(outboxJobs)
    .values({
      businessId: opts.businessId,
      connectionId: conv.connectionId,
      kind: 'telegram_send',
      payload: {
        messageId,
        conversationId: conv.id,
        chatId: conv.externalThreadId,
        text: bodyText || undefined,
        mediaPath,
        mediaKind,
        mediaMime,
        mediaFilename,
      },
      status: 'pending',
    })
    .returning()

  const job = jobs[0]
  if (job) await processTelegramOutboxJob(job.id)

  const msgRows = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1)
  return msgRows[0]!
}

/** Connections usable as Inbox sources (enabled inbox binding), any provider. */
export async function listTelegramConnections(businessId: string) {
  const bound = await db
    .select({ connectionId: moduleBindings.connectionId })
    .from(moduleBindings)
    .where(
      and(
        eq(moduleBindings.businessId, businessId),
        eq(moduleBindings.module, 'inbox'),
        eq(moduleBindings.enabled, true),
      ),
    )
  const ids = [...new Set(bound.map((b) => b.connectionId))]
  if (ids.length === 0) return []

  const rows = await db
    .select()
    .from(connections)
    .where(eq(connections.businessId, businessId))

  return rows
    .filter((r) => ids.includes(r.id))
    .map((r) => ({
      id: r.id,
      provider: r.provider,
      authMethod: r.authMethod,
      displayName: r.displayName,
      status: r.status,
      externalAccountId: r.externalAccountId,
      accountType: r.accountType,
      composerFormats: composerFormatsForConnection({
        provider: r.provider,
        capabilitiesCache: r.capabilitiesCache,
      }),
    }))
}
