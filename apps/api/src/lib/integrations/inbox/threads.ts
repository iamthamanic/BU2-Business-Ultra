/**
 * Shared Inbox persistence helpers for channel sync (Telegram bot, Unipile, Gmail).
 * Location: apps/api/src/lib/integrations/inbox/threads.ts
 */
import { and, eq } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { contactIdentities, conversations, moduleBindings } from '../../../db/schema.js'

/** Idempotently enable inbox read_dm / send_dm / sync bindings for a connection. */
export async function ensureInboxBindings(businessId: string, connectionId: string) {
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

/** Find-or-create a `telegram_user` contact identity; refreshes displayName on change. */
export async function upsertTelegramUserIdentity(
  businessId: string,
  value: string,
  displayName: string,
  confidence: 'high' | 'medium',
) {
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
      confidence,
    })
    .returning()
  return rows[0]!.id
}

/** Find-or-create a conversation by (connection, external thread); reopens + bumps preview. */
export async function upsertConversation(opts: {
  businessId: string
  connectionId: string
  channel: string
  externalThreadId: string
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
        eq(conversations.externalThreadId, opts.externalThreadId),
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
      channel: opts.channel,
      externalThreadId: opts.externalThreadId,
      title: opts.title,
      contactIdentityId: opts.identityId,
      lastMessageAt: opts.at,
      lastPreview: opts.preview,
      status: 'open',
    })
    .returning()
  return rows[0]!.id
}
