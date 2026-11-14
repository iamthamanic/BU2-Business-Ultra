/**
 * Gmail inbox sync + reply via Integration Core OAuth connection.
 * Location: apps/api/src/lib/integrations/gmail/inboxSync.ts
 */
import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db } from '../../../db/client.js'
import {
  connections,
  contactIdentities,
  conversations,
  messages,
  syncCursors,
} from '../../../db/schema.js'
import { parseCapabilitiesCache, purposeAllowed } from '../core/capabilities.js'
import { bumpConversationUnread } from '../inbox/unread.js'
import { getGoogleAccessToken } from '../google/tokens.js'
import {
  buildReplyRfc822,
  extractPlainText,
  getThread,
  gmailHeader,
  listInboxThreads,
  parseEmailAddress,
  sendGmailRaw,
  type GmailMessage,
} from './api.js'

const STREAM = 'gmail:threads'

function previewOf(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length > 280 ? `${t.slice(0, 277)}…` : t
}

async function upsertEmailIdentity(businessId: string, email: string, displayName: string) {
  const value = email.toLowerCase()
  const existing = await db
    .select()
    .from(contactIdentities)
    .where(
      and(
        eq(contactIdentities.businessId, businessId),
        eq(contactIdentities.kind, 'email'),
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
      kind: 'email',
      value,
      displayName: displayName || value,
      confidence: 'high',
    })
    .returning()
  return rows[0]!.id
}

async function upsertEmailConversation(opts: {
  businessId: string
  connectionId: string
  threadId: string
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
        eq(conversations.externalThreadId, opts.threadId),
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
      channel: 'email',
      externalThreadId: opts.threadId,
      title: opts.title,
      contactIdentityId: opts.identityId,
      lastMessageAt: opts.at,
      lastPreview: opts.preview,
      status: 'open',
    })
    .returning()
  return rows[0]!.id
}

async function insertGmailMessage(opts: {
  businessId: string
  connectionId: string
  conversationId: string
  msg: GmailMessage
  mailboxEmail: string
}) {
  const from = gmailHeader(opts.msg, 'From')
  const fromEmail = parseEmailAddress(from).toLowerCase()
  const direction =
    fromEmail && opts.mailboxEmail && fromEmail === opts.mailboxEmail.toLowerCase()
      ? 'outbound'
      : 'inbound'
  const body = extractPlainText(opts.msg)
  const at = opts.msg.internalDate
    ? new Date(Number(opts.msg.internalDate))
    : new Date()
  try {
    await db.insert(messages).values({
      businessId: opts.businessId,
      connectionId: opts.connectionId,
      conversationId: opts.conversationId,
      direction,
      providerMessageId: `gmail:${opts.msg.id}`,
      bodyText: body,
      deliveryStatus: direction === 'inbound' ? 'received' : 'sent',
      sentAt: at,
      raw: {
        gmailId: opts.msg.id,
        threadId: opts.msg.threadId,
        subject: gmailHeader(opts.msg, 'Subject'),
        from,
        to: gmailHeader(opts.msg, 'To'),
        messageId: gmailHeader(opts.msg, 'Message-Id') || gmailHeader(opts.msg, 'Message-ID'),
      },
    })
    if (direction === 'inbound') {
      await bumpConversationUnread(opts.conversationId, opts.businessId)
    }
    return true
  } catch (e) {
    const msg = String(e)
    if (msg.includes('messages_conn_provider_msg_uidx') || msg.includes('unique')) return false
    throw e
  }
}

export async function syncGmailConnection(businessId: string, connectionId: string) {
  const capsRow = await db
    .select()
    .from(connections)
    .where(and(eq(connections.id, connectionId), eq(connections.businessId, businessId)))
    .limit(1)
  const conn = capsRow[0]
  if (!conn || conn.provider !== 'google') {
    throw Object.assign(new Error('connection_not_found'), { statusCode: 404 })
  }
  const allowed = purposeAllowed(parseCapabilitiesCache(conn.capabilitiesCache), 'sync')
  if (!allowed.allowed) {
    throw Object.assign(new Error(allowed.reason || 'capability_denied'), { statusCode: 409 })
  }

  const { accessToken } = await getGoogleAccessToken(businessId, connectionId)
  const mailboxEmail = conn.externalAccountId
  const listed = await listInboxThreads(accessToken, { maxResults: 20 })
  let imported = 0

  for (const t of listed.threads || []) {
    if (!t.id) continue
    const full = await getThread(accessToken, t.id)
    const msgs = full.messages || []
    if (!msgs.length) continue
    const last = msgs[msgs.length - 1]!
    const subject = gmailHeader(last, 'Subject') || '(ohne Betreff)'
    const from = gmailHeader(msgs[0]!, 'From') || gmailHeader(last, 'From')
    const fromEmail = parseEmailAddress(from) || 'unknown'
    const title = subject
    const body = extractPlainText(last)
    const at = last.internalDate ? new Date(Number(last.internalDate)) : new Date()
    const identityId = await upsertEmailIdentity(businessId, fromEmail, from)
    const conversationId = await upsertEmailConversation({
      businessId,
      connectionId,
      threadId: t.id,
      title,
      identityId,
      preview: previewOf(body || t.snippet || ''),
      at,
    })
    for (const m of msgs) {
      const ok = await insertGmailMessage({
        businessId,
        connectionId,
        conversationId,
        msg: m,
        mailboxEmail,
      })
      if (ok) imported++
    }
  }

  const cursorRows = await db
    .select()
    .from(syncCursors)
    .where(and(eq(syncCursors.connectionId, connectionId), eq(syncCursors.stream, STREAM)))
    .limit(1)
  const cursor = listed.nextPageToken || new Date().toISOString()
  if (cursorRows[0]) {
    await db
      .update(syncCursors)
      .set({ cursor, renewedAt: new Date(), updatedAt: new Date() })
      .where(eq(syncCursors.id, cursorRows[0].id))
  } else {
    await db.insert(syncCursors).values({
      connectionId,
      stream: STREAM,
      cursor,
      renewedAt: new Date(),
    })
  }

  return { imported, threads: listed.threads?.length ?? 0, cursor }
}

export async function replyGmailConversation(opts: {
  businessId: string
  conversationId: string
  connectionId: string
  threadId: string
  body: string
  userId: string
}) {
  const { accessToken } = await getGoogleAccessToken(opts.businessId, opts.connectionId)
  const connRows = await db
    .select()
    .from(connections)
    .where(
      and(eq(connections.id, opts.connectionId), eq(connections.businessId, opts.businessId)),
    )
    .limit(1)
  const conn = connRows[0]
  if (!conn) throw Object.assign(new Error('connection_not_found'), { statusCode: 404 })

  const sendCap = purposeAllowed(parseCapabilitiesCache(conn.capabilitiesCache), 'send_mail')
  if (!sendCap.allowed) {
    throw Object.assign(new Error(sendCap.reason || 'capability_denied'), { statusCode: 409 })
  }

  const thread = await getThread(accessToken, opts.threadId)
  const msgs = thread.messages || []
  const last = msgs[msgs.length - 1]
  if (!last) throw Object.assign(new Error('thread_empty'), { statusCode: 409 })

  const subject = gmailHeader(last, 'Subject') || 'Re:'
  const replyToRaw = gmailHeader(last, 'Reply-To') || gmailHeader(last, 'From')
  const to = parseEmailAddress(replyToRaw)
  const messageIdHdr =
    gmailHeader(last, 'Message-Id') || gmailHeader(last, 'Message-ID') || undefined
  const references = [gmailHeader(last, 'References'), messageIdHdr].filter(Boolean).join(' ')
  const from = conn.externalAccountId

  const rfc = buildReplyRfc822({
    to,
    from,
    subject,
    body: opts.body,
    inReplyTo: messageIdHdr,
    references: references || undefined,
  })

  const messageId = randomUUID()
  const provisional = `pending:${messageId}`
  await db.insert(messages).values({
    id: messageId,
    businessId: opts.businessId,
    conversationId: opts.conversationId,
    connectionId: opts.connectionId,
    direction: 'outbound',
    providerMessageId: provisional,
    bodyText: opts.body,
    deliveryStatus: 'pending',
    raw: { byUserId: opts.userId },
  })

  try {
    const sent = await sendGmailRaw(accessToken, rfc, opts.threadId)
    await db
      .update(messages)
      .set({
        deliveryStatus: 'sent',
        providerMessageId: `gmail:${sent.id}`,
        sentAt: new Date(),
        errorDetail: null,
        raw: { byUserId: opts.userId, gmailId: sent.id, threadId: sent.threadId },
      })
      .where(eq(messages.id, messageId))
  } catch (e) {
    const detail = String((e as Error).message || e).slice(0, 500)
    await db
      .update(messages)
      .set({ deliveryStatus: 'failed', errorDetail: detail })
      .where(eq(messages.id, messageId))
    throw e
  }

  await db
    .update(conversations)
    .set({
      lastMessageAt: new Date(),
      lastPreview: previewOf(opts.body),
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, opts.conversationId))

  const msgRows = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1)
  return msgRows[0]!
}
