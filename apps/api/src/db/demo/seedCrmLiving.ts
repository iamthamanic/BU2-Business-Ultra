/**
 * Cross-link demo CRM timeline with inbox, notes, purchases, consents.
 * Location: apps/api/src/db/demo/seedCrmLiving.ts
 */
import { and, asc, eq, isNotNull } from 'drizzle-orm'
import { db } from '../client.js'
import {
  contactIdentities,
  conversations,
  customerConsents,
  customerEvents,
  customerNotes,
  customerPurchases,
  messages,
} from '../schema.js'
import { DEMO_MARKER } from './firms.js'

function daysAgo(n: number, hour = 12): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  d.setUTCHours(hour, 20, 0, 0)
  return d
}

function commChannel(inboxChannel: string): 'email' | 'phone' | 'whatsapp' | 'meeting' | 'other' {
  if (inboxChannel === 'email') return 'email'
  if (inboxChannel === 'whatsapp') return 'whatsapp'
  return 'other'
}

export async function seedCrmLivingHistory(opts: {
  businessId: string
  ownerId: string
  staffUserId: string
  contactIds: string[]
}) {
  const { businessId, ownerId, staffUserId, contactIds } = opts

  for (const customerId of contactIds) {
    await db.insert(customerEvents).values({
      customerId,
      type: 'created',
      summary: 'Kontakt angelegt (Demo)',
      actorUserId: ownerId,
      meta: { demo: true, marker: DEMO_MARKER },
      createdAt: daysAgo(40),
    })
  }

  const allNotes = []
  for (const customerId of contactIds) {
    const rows = await db
      .select()
      .from(customerNotes)
      .where(eq(customerNotes.customerId, customerId))
      .orderBy(asc(customerNotes.createdAt))
    allNotes.push(...rows)
  }
  for (const [i, note] of allNotes.entries()) {
    await db.insert(customerEvents).values({
      customerId: note.customerId,
      type: 'note',
      summary: note.body.slice(0, 180),
      actorUserId: note.authorUserId || staffUserId,
      meta: { noteId: note.id, demo: true },
      createdAt: daysAgo(35 - Math.min(i, 30), 11),
    })
  }

  const purchases = await db
    .select()
    .from(customerPurchases)
    .where(eq(customerPurchases.businessId, businessId))
  for (const [i, p] of purchases.entries()) {
    await db.insert(customerEvents).values({
      customerId: p.customerId,
      type: 'purchase',
      summary: `Kauf: ${p.label} (${(p.amountCents / 100).toFixed(2)} ${p.currency})`,
      actorUserId: staffUserId,
      meta: { purchaseId: p.id, amountCents: p.amountCents, demo: true },
      createdAt: p.purchasedAt || daysAgo(20 - i),
    })
  }

  // Consents for customer contacts (skip pure partners without customer flag — we only have ids)
  for (const [i, customerId] of contactIds.entries()) {
    if (i % 3 === 2) continue // leave some without newsletter consent
    await db.insert(customerConsents).values({
      customerId,
      purpose: 'newsletter',
      channel: 'email',
      grantedAt: daysAgo(30 - i),
      evidence: `Demo Opt-in (${DEMO_MARKER})`,
    })
    await db.insert(customerEvents).values({
      customerId,
      type: 'consent',
      summary: 'Einwilligung Newsletter (E-Mail)',
      actorUserId: ownerId,
      meta: { purpose: 'newsletter', channel: 'email', demo: true },
      createdAt: daysAgo(30 - i, 9),
    })
    if (i === 0) {
      await db.insert(customerConsents).values({
        customerId,
        purpose: 'whatsapp_updates',
        channel: 'whatsapp',
        grantedAt: daysAgo(28),
        evidence: `Demo WA Opt-in (${DEMO_MARKER})`,
      })
    }
  }

  // Mirror inbox threads → CRM communication timeline
  const linkedIdentities = await db
    .select()
    .from(contactIdentities)
    .where(
      and(eq(contactIdentities.businessId, businessId), isNotNull(contactIdentities.customerId)),
    )

  for (const identity of linkedIdentities) {
    if (!identity.customerId) continue
    const convs = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.businessId, businessId),
          eq(conversations.contactIdentityId, identity.id),
        ),
      )
    for (const conv of convs) {
      const msgs = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(asc(messages.createdAt))
      for (const msg of msgs) {
        const ch = commChannel(conv.channel)
        const preview = msg.bodyText.replace(/\s+/g, ' ').slice(0, 140)
        const who =
          msg.direction === 'inbound'
            ? identity.displayName || identity.value
            : 'Team'
        await db.insert(customerEvents).values({
          customerId: identity.customerId,
          type: 'communication',
          summary:
            msg.direction === 'inbound'
              ? `${who} (${conv.channel}): ${preview}`
              : `Antwort über ${conv.channel}: ${preview}`,
          actorUserId: msg.direction === 'outbound' ? staffUserId : null,
          meta: {
            channel: ch,
            inboxChannel: conv.channel,
            conversationId: conv.id,
            messageId: msg.id,
            direction: msg.direction,
            demo: true,
          },
          createdAt: msg.sentAt || msg.createdAt,
        })
      }
    }
  }
}
