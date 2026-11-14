/**
 * Conversation unread counter helpers (Inbox step 04).
 * Location: apps/api/src/lib/integrations/inbox/unread.ts
 */
import { and, eq, sql } from 'drizzle-orm'
import { db } from '../../../db/client.js'
import { conversations } from '../../../db/schema.js'

/** +1 unread after a newly inserted inbound message (idempotent insert already filtered). */
export async function bumpConversationUnread(conversationId: string, businessId: string) {
  await db
    .update(conversations)
    .set({
      unreadCount: sql`${conversations.unreadCount} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(conversations.id, conversationId), eq(conversations.businessId, businessId)))
}

/** Clear unread when a member opens the thread. */
export async function markConversationRead(conversationId: string, businessId: string) {
  await db
    .update(conversations)
    .set({ unreadCount: 0, updatedAt: new Date() })
    .where(and(eq(conversations.id, conversationId), eq(conversations.businessId, businessId)))
}
