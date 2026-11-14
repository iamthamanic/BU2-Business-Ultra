/**
 * Rich multi-channel inbox demo data (connections, identities, threads, messages).
 * Location: apps/api/src/db/demo/seedInbox.ts
 */
import { sealSecret } from '../../lib/crypto.js'
import { db } from '../client.js'
import {
  connectionCredentials,
  connections,
  contactIdentities,
  conversations,
  messages,
  moduleBindings,
} from '../schema.js'
import { DEMO_MARKER, type DemoDepth, type DemoFirm } from './firms.js'

export type SeedContact = {
  id: string
  displayName: string
  email: string | null
  phone: string | null
}

type Msg = { direction: 'inbound' | 'outbound'; body: string; daysAgo: number; hour?: number }

function isoDaysAgo(n: number, hour = 10): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  d.setUTCHours(hour, 15, 0, 0)
  return d
}

async function seedConnection(opts: {
  businessId: string
  ownerId: string
  provider: string
  authMethod: string
  externalAccountId: string
  displayName: string
  accountType: string
  purpose?: string
  bindFinance?: boolean
}) {
  const sealed = sealSecret(`demo:${opts.provider}:${DEMO_MARKER}`)
  const [conn] = await db
    .insert(connections)
    .values({
      businessId: opts.businessId,
      provider: opts.provider,
      authMethod: opts.authMethod,
      externalAccountId: opts.externalAccountId,
      displayName: opts.displayName,
      status: 'active',
      accountType: opts.accountType,
      health: {
        ok: true,
        adapter: opts.provider,
        checkedAt: new Date().toISOString(),
        note: DEMO_MARKER,
      },
      capabilitiesCache: [],
      createdByUserId: opts.ownerId,
    })
    .returning()
  await db.insert(connectionCredentials).values({
    connectionId: conn!.id,
    kind: 'demo_token',
    ciphertext: sealed.ciphertext,
    iv: sealed.iv,
    tag: sealed.tag,
    keyHint: 'demo…',
  })
  if (opts.purpose) {
    await db.insert(moduleBindings).values({
      businessId: opts.businessId,
      connectionId: conn!.id,
      module: 'inbox',
      purpose: opts.purpose,
      enabled: true,
    })
  }
  if (opts.bindFinance) {
    await db.insert(moduleBindings).values({
      businessId: opts.businessId,
      connectionId: conn!.id,
      module: 'finance',
      purpose: 'bank_sync',
      enabled: true,
    })
  }
  return conn!
}

async function seedIdentity(opts: {
  businessId: string
  kind: string
  value: string
  displayName: string
  customerId: string | null
  confidence?: string
}) {
  const [row] = await db
    .insert(contactIdentities)
    .values({
      businessId: opts.businessId,
      kind: opts.kind,
      value: opts.value,
      displayName: opts.displayName,
      customerId: opts.customerId,
      confidence: opts.confidence ?? (opts.customerId ? 'high' : 'medium'),
      confirmedAt: opts.customerId ? new Date() : null,
    })
    .returning()
  return row!
}

async function seedThread(opts: {
  businessId: string
  connectionId: string
  channel: string
  externalThreadId: string
  title: string
  identityId: string
  status?: string
  /** null = unassigned queue */
  assigneeUserId: string | null
  /** Force unread; default = trailing inbound streak. */
  unreadCount?: number
  messages: Msg[]
}) {
  const last = opts.messages[opts.messages.length - 1]!
  let trailingInbound = 0
  for (let i = opts.messages.length - 1; i >= 0; i--) {
    if (opts.messages[i]!.direction !== 'inbound') break
    trailingInbound++
  }
  const unreadCount = opts.unreadCount ?? trailingInbound
  const [conv] = await db
    .insert(conversations)
    .values({
      businessId: opts.businessId,
      connectionId: opts.connectionId,
      channel: opts.channel,
      externalThreadId: opts.externalThreadId,
      title: opts.title,
      status: opts.status ?? 'open',
      assigneeUserId: opts.assigneeUserId,
      contactIdentityId: opts.identityId,
      unreadCount,
      lastMessageAt: isoDaysAgo(last.daysAgo, last.hour ?? 14),
      lastPreview: last.body.slice(0, 160),
    })
    .returning()

  await db.insert(messages).values(
    opts.messages.map((m, i) => ({
      businessId: opts.businessId,
      conversationId: conv!.id,
      connectionId: opts.connectionId,
      direction: m.direction,
      providerMessageId: `${opts.externalThreadId}-msg-${i}`,
      bodyText: m.body,
      deliveryStatus: m.direction === 'inbound' ? 'received' : 'sent',
      sentAt: isoDaysAgo(m.daysAgo, m.hour ?? 10 + i),
      createdAt: isoDaysAgo(m.daysAgo, m.hour ?? 10 + i),
      raw:
        m.direction === 'outbound'
          ? {
              demo: true,
              marker: DEMO_MARKER,
              byUserId: opts.assigneeUserId || undefined,
            }
          : { demo: true, marker: DEMO_MARKER },
    })),
  )
  return conv!
}

function channelPlan(depth: DemoDepth, firm: DemoFirm) {
  const domain = `${firm.slug}.example`
  const base = [
    {
      provider: 'google',
      authMethod: 'oauth_pkce',
      externalAccountId: `demo:gmail:info@${domain}`,
      displayName: `Gmail · info@${domain}`,
      accountType: 'gmail',
      purpose: 'messaging',
    },
    {
      provider: 'whatsapp',
      authMethod: 'oauth_pkce',
      externalAccountId: `demo:wa:${firm.slug}`,
      displayName: `WhatsApp Business · ${firm.name}`,
      accountType: 'whatsapp_business',
      purpose: 'messaging',
    },
  ]
  if (depth === 'S') return base
  const mid = [
    ...base,
    {
      provider: 'google',
      authMethod: 'oauth_pkce',
      externalAccountId: `demo:gmail:buchung@${domain}`,
      displayName: `Gmail · buchung@${domain}`,
      accountType: 'gmail',
      purpose: 'messaging',
    },
    {
      provider: 'telegram',
      authMethod: 'bot_token',
      externalAccountId: `demo:tg-bot:${firm.slug}`,
      displayName: `Telegram Bot · @${firm.slug.replace(/-/g, '_')}_bot`,
      accountType: 'telegram_bot',
      purpose: 'messaging',
    },
    {
      provider: 'instagram',
      authMethod: 'oauth_pkce',
      externalAccountId: `demo:ig:${firm.slug}`,
      displayName: `Instagram · @${firm.slug.replace(/-/g, '')}`,
      accountType: 'instagram_business',
      purpose: 'messaging',
    },
  ]
  if (depth === 'M') return mid
  return [
    ...mid,
    {
      provider: 'microsoft',
      authMethod: 'oauth_pkce',
      externalAccountId: `demo:outlook:office@${domain}`,
      displayName: `Outlook · office@${domain}`,
      accountType: 'outlook',
      purpose: 'messaging',
    },
    {
      provider: 'unipile',
      authMethod: 'aggregator_session',
      externalAccountId: `demo:tg-user:${firm.slug}`,
      displayName: `Telegram privat · ${firm.name}`,
      accountType: 'telegram_user',
      purpose: 'messaging',
    },
  ]
}

type Scripts = {
  customerMail: { title: string; messages: Msg[] }
  leadMail: { title: string; messages: Msg[] }
  whatsapp: { title: string; messages: Msg[] }
  booking?: { title: string; messages: Msg[] }
  telegram?: { title: string; messages: Msg[] }
  instagram?: { title: string; messages: Msg[] }
  outlook?: { title: string; messages: Msg[] }
  telegramUser?: { title: string; messages: Msg[] }
  closed?: { title: string; messages: Msg[] }
}

function firstName(displayName: string) {
  return displayName.split(/\s+/)[0] || displayName
}

function scriptsFor(firm: DemoFirm, contacts: SeedContact[], domain: string): Scripts {
  const c0 = contacts[0]
  const c1 = contacts[1]
  const c2 = contacts[2]
  const n0 = c0?.displayName || 'Kund:in'
  const n1 = c1?.displayName || 'Partner'
  const n2 = c2?.displayName || 'Kontakt'

  if (firm.slug === 'wendy-spirit') {
    return {
      customerMail: {
        title: `${n0} · Reitstunde Samstag`,
        messages: [
          {
            direction: 'inbound',
            daysAgo: 6,
            body: `Hallo Wendy-Team, hier ist ${n0}. Mia möchte Samstag wieder reiten — geht 10:00 noch? Bitte auf Luna, wenn möglich.`,
          },
          {
            direction: 'outbound',
            daysAgo: 6,
            hour: 12,
            body: `Hi ${firstName(n0)}, Samstag 10:00 ist frei und Luna ist eingeplant. Soll ich die Einheit von der 10er-Karte abziehen?`,
          },
          {
            direction: 'inbound',
            daysAgo: 5,
            body: 'Ja bitte. Und könntet ihr die letzte Rechnung nochmal schicken? Brauche sie für die Steuer.',
          },
          {
            direction: 'outbound',
            daysAgo: 5,
            hour: 16,
            body: 'Passt. Rechnung als PDF im Anhang, Termin steht. Bis Samstag — Helm nicht vergessen 🐴',
          },
          {
            direction: 'inbound',
            daysAgo: 1,
            body: 'Perfekt, danke! Mia freut sich schon.',
          },
        ],
      },
      leadMail: {
        title: 'Neue Anfrage · Probestunde',
        messages: [
          {
            direction: 'inbound',
            daysAgo: 2,
            body: 'Guten Tag, wir haben eure Instagram-Seite gefunden. Unsere Tochter (8) möchte reiten lernen. Was kostet eine Probestunde und braucht sie schon einen eigenen Helm?',
          },
          {
            direction: 'outbound',
            daysAgo: 2,
            hour: 15,
            body: 'Schön, dass ihr meldet! Probestunde 45 Min. kostet 48 € inkl. Schulpferd. Helm leihen wir einmalig aus — ab der 2. Stunde eigenen. Soll ich euch Freitag oder Samstag anbieten?',
          },
          {
            direction: 'inbound',
            daysAgo: 0,
            hour: 9,
            body: 'Samstag Vormittag wäre super. Können wir vorher kurz den Hof anschauen?',
          },
        ],
      },
      whatsapp: {
        title: `${n0} · WhatsApp`,
        messages: [
          {
            direction: 'inbound',
            daysAgo: 3,
            body: 'Hey Wendy 👋 Kurze Frage: Samstag noch frei? Mia ist erkältet gewesen, aber jetzt wieder fit.',
          },
          {
            direction: 'outbound',
            daysAgo: 3,
            hour: 11,
            body: 'Jo, 10:00 steht. Wenn ihr unsicher seid, sagt bis Freitag 18 Uhr Bescheid — sonst reservieren wir Luna.',
          },
          {
            direction: 'inbound',
            daysAgo: 3,
            hour: 11,
            body: 'Wir kommen! Danke 👍',
          },
        ],
      },
    }
  }

  if (firm.slug === 'physiopraxis-hammer') {
    return {
      customerMail: {
        title: `${n0} · Termin / Rezept`,
        messages: [
          {
            direction: 'inbound',
            daysAgo: 6,
            body: `Guten Tag, hier ist ${n0}. Mein KG-Rezept (6×) ist fast durch — ich brauche nächste Woche noch 2 Termine. Geht Dienstag und Donnerstag Vormittag?`,
          },
          {
            direction: 'outbound',
            daysAgo: 6,
            hour: 12,
            body: `Hallo ${firstName(n0)}, Di 10:00 bei Frau Berger und Do 11:30 bei Herrn Klein sind frei. Zuzahlung wie gehabt 10 € + 10 € Rezeptgebühr, falls noch offen.`,
          },
          {
            direction: 'inbound',
            daysAgo: 5,
            body: 'Donnerstag 11:30 passt. Könntet ihr mir die letzte Quittung nochmal mailen? Brauche sie für die Beihilfe.',
          },
          {
            direction: 'outbound',
            daysAgo: 5,
            hour: 16,
            body: 'Do 11:30 ist gebucht. Quittung vom 12.02. hängt als PDF dran. Bis Donnerstag!',
          },
          {
            direction: 'inbound',
            daysAgo: 1,
            body: 'Perfekt, danke! Bis Donnerstag.',
          },
        ],
      },
      leadMail: {
        title: 'Neue Anfrage · Erstbefund / Preise',
        messages: [
          {
            direction: 'inbound',
            daysAgo: 2,
            body: 'Guten Tag, ich habe akute Rückenschmerzen (LWS) und ein Rezept vom Orthopäden. Habt ihr noch Kapazität für einen Erstbefund diese Woche? Was muss ich als Kassenpatient:in mitbringen?',
          },
          {
            direction: 'outbound',
            daysAgo: 2,
            hour: 15,
            body: 'Danke für Ihre Nachricht. Erstbefund 45–60 Min., mit Rezept bitte Versichertenkarte + Zuzahlung mitbringen. Freitag 14:15 oder Montag 09:00 wären frei — welchen Slot soll ich halten?',
          },
          {
            direction: 'inbound',
            daysAgo: 0,
            hour: 9,
            body: 'Freitag 14:15 bitte. Rückruf morgen Vormittag wäre hilfreich, falls sich was verschiebt.',
          },
        ],
      },
      whatsapp: {
        title: `${n0} · WhatsApp`,
        messages: [
          {
            direction: 'inbound',
            daysAgo: 3,
            body: 'Hallo Praxis 👋 Kurze Frage: Ist mein Termin Do 11:30 noch bestätigt? Hatte gestern Fieber, bin aber wieder fieberfrei.',
          },
          {
            direction: 'outbound',
            daysAgo: 3,
            hour: 11,
            body: 'Ja, Do 11:30 steht. Bitte 5 Min. früher kommen wegen Desinfektion / Umkleide. Wir schreiben 1h vorher nochmal.',
          },
          {
            direction: 'inbound',
            daysAgo: 3,
            hour: 11,
            body: 'Top 👍',
          },
        ],
      },
      booking: {
        title: `${n1} · Zuweisung / Buchung`,
        messages: [
          {
            direction: 'inbound',
            daysAgo: 8,
            body: `An buchung@${domain}: Bitte 2 Patient:innen von Praxis Keller für nächste Woche vormerken — Rezepte folgen per Fax.`,
          },
          {
            direction: 'outbound',
            daysAgo: 7,
            body: 'Reserviert: Mi 08:30 und Do 09:15. Bitte Namen + Versicherungsstatus nachreichen.',
          },
          {
            direction: 'inbound',
            daysAgo: 4,
            body: 'Können wir auf 3 Slots erhöhen? Dritter Patient ist Selbstzahler MT.',
          },
          {
            direction: 'outbound',
            daysAgo: 4,
            hour: 13,
            body: 'Erledigt — Fr 16:00 MT Selbstzahler ergänzt. Kalender ist aktualisiert.',
          },
        ],
      },
      telegram: {
        title: 'Telegram · Termin-Bot',
        messages: [
          { direction: 'inbound', daysAgo: 2, body: '/start' },
          {
            direction: 'outbound',
            daysAgo: 2,
            hour: 10,
            body: 'Willkommen bei der Physiopraxis Hammer. Schreib uns kurz: Rezept / Selbstzahler / Kurs Rückenfit?',
          },
          {
            direction: 'inbound',
            daysAgo: 1,
            body: 'Rezept KG, LWS. Habt ihr noch Kapazität diese Woche?',
          },
          {
            direction: 'outbound',
            daysAgo: 1,
            hour: 12,
            body: 'Zwei Slots frei (Fr 14:15, Mo 09:00). Für Details am besten Mail an info@ oder WhatsApp — dann legen wir den Termin fest.',
          },
        ],
      },
      instagram: {
        title: `IG DM · ${n2}`,
        messages: [
          {
            direction: 'inbound',
            daysAgo: 4,
            body: 'Hey, euer Reel zu Rückenfit war stark! Können wir für den Verein noch Plätze für den nächsten Kursblock buchen?',
          },
          {
            direction: 'outbound',
            daysAgo: 3,
            body: 'Danke! Ja — Q2-Kurs Di 18:00, noch 3 Plätze. Ich schick den Anmeldelink + SV-Lech-Konditionen.',
          },
          {
            direction: 'inbound',
            daysAgo: 3,
            hour: 18,
            body: 'Hab für 4 Leute gebucht 🙌 Rechnung bitte an gesundheit@sv-lech.de',
          },
        ],
      },
    }
  }

  // SagaTree VTT (L)
  return {
    customerMail: {
      title: `${n0} · Pro Abo / Support`,
      messages: [
        {
          direction: 'inbound',
          daysAgo: 6,
          body: `Hi SagaTree-Team, ${n0} hier (Pro). Seit dem letzten Update ruckelt Fog auf meinem MacBook Air M1 bei 4 Spielern. Könnt ihr schauen, ob das in 2.4 drin ist?`,
        },
        {
          direction: 'outbound',
          daysAgo: 6,
          hour: 12,
          body: `Hey ${firstName(n0)}, ja — 2.4 bringt die Fog-Performance-Fixes. Beta-Flag kann ich dir freischalten, oder du wartest auf den Stable-Drop Freitag.`,
        },
        {
          direction: 'inbound',
          daysAgo: 5,
          body: 'Bitte Beta. Und schickt mir die letzte Rechnung nochmal — brauche sie für die Spielegruppe.',
        },
        {
          direction: 'outbound',
          daysAgo: 5,
          hour: 16,
          body: 'Beta ist an deinem Account. Rechnung Pro Feb im Anhang. Wenn Fog weiter zuckt: Discord #perf mit Device-Log.',
        },
        {
          direction: 'inbound',
          daysAgo: 1,
          body: 'Läuft schon spürbar besser — danke! Bis zum Creator-Stream.',
        },
      ],
    },
    leadMail: {
      title: 'Neue Anfrage · Trial / Preise',
      messages: [
        {
          direction: 'inbound',
          daysAgo: 2,
          body: 'Hallo, wir suchen eine VTT-Alternative zu Roll20 für unsere DE-Gruppe (5 Leute). Was kostet Pro monatlich und gibt’s einen Trial ohne Kreditkarte?',
        },
        {
          direction: 'outbound',
          daysAgo: 2,
          hour: 15,
          body: 'Pro liegt bei 12,90 €/Monat (oder Studio jährlich). 14-Tage-Trial ohne Karte — Link: app.sagatree.example/trial. Soll ich euch das Fantasy-Commons-Pack dazu legen?',
        },
        {
          direction: 'inbound',
          daysAgo: 0,
          hour: 9,
          body: 'Ja bitte Trial + Pack. Rückruf morgen Vormittag wäre top, falls wir White-Label für den Verein brauchen.',
        },
      ],
    },
    whatsapp: {
      title: `${n0} · WhatsApp`,
      messages: [
        {
          direction: 'inbound',
          daysAgo: 3,
          body: 'Kurzer Ping — Creator-Stream Donnerstag noch on? Wollte Lichtsets live zeigen.',
        },
        {
          direction: 'outbound',
          daysAgo: 3,
          hour: 11,
          body: 'Ja, 19:30 CET. Ich schick dir 1h vorher den Stage-Link + Demo-Tisch.',
        },
        {
          direction: 'inbound',
          daysAgo: 3,
          hour: 11,
          body: 'Top 👍',
        },
      ],
    },
    booking: {
      title: `${n1} · Partner / Marketplace`,
      messages: [
        {
          direction: 'inbound',
          daysAgo: 8,
          body: `An buchung@${domain}: Fantasy-Commons Pack ist ready. Bitte Soft-Launch Slot + Feature-Flag für Early Access.`,
        },
        {
          direction: 'outbound',
          daysAgo: 7,
          body: 'Slot Di 10:00 CET reserviert. Manifest-Review läuft — Breaking Change Hinweis geht parallel an Creator.',
        },
        {
          direction: 'inbound',
          daysAgo: 4,
          body: 'Können wir auf 3 Spotlight-Posts erhöhen (IG + Discord + Newsletter)?',
        },
        {
          direction: 'outbound',
          daysAgo: 4,
          hour: 13,
          body: 'Erledigt — Kalender + Brevo Draft sind aktualisiert.',
        },
      ],
    },
    telegram: {
      title: 'Telegram · Support-Bot',
      messages: [
        { direction: 'inbound', daysAgo: 2, body: '/start' },
        {
          direction: 'outbound',
          daysAgo: 2,
          hour: 10,
          body: 'Willkommen bei SagaTree Support. Billing, Bug oder Feature?',
        },
        {
          direction: 'inbound',
          daysAgo: 1,
          body: 'Bug: Sync bricht ab wenn zwei GMs denselben Tisch öffnen.',
        },
        {
          direction: 'outbound',
          daysAgo: 1,
          hour: 12,
          body: 'Kenn ich — Ticket #442. Workaround: einer refreshed nach 10s. Fix landet in 2.4. Mail oder Discord für Logs?',
        },
      ],
    },
    instagram: {
      title: `IG DM · ${n2}`,
      messages: [
        {
          direction: 'inbound',
          daysAgo: 4,
          body: 'Euer 2.4-Teaser sah krank aus 🔥 Wann kommt der Marketplace-Drop von DiceForge?',
        },
        {
          direction: 'outbound',
          daysAgo: 3,
          body: 'Danke! Fantasy Commons geht Di live — Link schick ich dir, sobald der Soft-Launch offen ist.',
        },
        {
          direction: 'inbound',
          daysAgo: 3,
          hour: 18,
          body: 'Hab gebucht 🙌 Gruppe ist hyped.',
        },
      ],
    },
    outlook: {
      title: 'Outlook · CloudPay / Billing',
      messages: [
        {
          direction: 'inbound',
          daysAgo: 9,
          body: 'Rechnung 2026-441 (Payment-Fees Feb) ist raus. Bitte Freigabe bis Freitag.',
        },
        {
          direction: 'outbound',
          daysAgo: 8,
          body: 'Danke — intern geprüft, Freigabe erteilt. DATEV-Export folgt Montag.',
        },
        {
          direction: 'inbound',
          daysAgo: 2,
          body: 'Payout-Batch verschiebt sich um einen Tag (Bankfeiertag). Passt das für eure Buchhaltung?',
        },
        {
          direction: 'outbound',
          daysAgo: 2,
          hour: 16,
          body: 'Passt. Bitte Tracking / Settlement-ID schicken.',
        },
        {
          direction: 'inbound',
          daysAgo: 0,
          hour: 8,
          body: 'Settlement: CP-EU-2026-03-08-441',
        },
      ],
    },
    telegramUser: {
      title: `${n1} · Telegram privat`,
      messages: [
        {
          direction: 'inbound',
          daysAgo: 1,
          body: 'Kurzer Ping privat — MSA White-Label HexGrid liegt bereit. Könnt ihr Security-Annex heute noch checken?',
        },
        {
          direction: 'outbound',
          daysAgo: 1,
          hour: 17,
          body: 'Schaue ich heute Abend. Offizielle Freigabe kommt per Mail an vorstand@hexgrid-ev.de.',
        },
      ],
    },
    closed: {
      title: `${n0} · Trial-Upgrade erledigt`,
      messages: [
        {
          direction: 'inbound',
          daysAgo: 20,
          body: 'Trial endet morgen — bitte auf Pro upgraden und alten Thread schließen.',
        },
        {
          direction: 'outbound',
          daysAgo: 19,
          body: 'Upgrade durch, Rechnung raus. Thread geschlossen — bei Fog-Themen bitte neuen Ticket-Thread.',
        },
      ],
    },
  }
}

/** Seed messaging + finance connections and multi-thread inbox content. */
export async function seedInboxBundle(opts: {
  firm: DemoFirm
  businessId: string
  ownerId: string
  /** Staff user who “answers” outbound demo messages (falls back to owner). */
  staffUserId?: string
  contacts: SeedContact[]
}): Promise<{ financeConnectionId: string }> {
  const { firm, businessId, ownerId, contacts } = opts
  const staffUserId = opts.staffUserId || ownerId
  const depth = firm.depth
  const c0 = contacts[0]
  const c1 = contacts[1]
  const c2 = contacts[2]
  const domain = `${firm.slug}.example`
  const scripts = scriptsFor(firm, contacts, domain)
  // Mixed assignment so "Zugewiesen" (owner login) and unassigned both have rows.

  const channelDefs = channelPlan(depth, firm)
  const connByKey = new Map<string, { id: string; displayName: string }>()
  for (const def of channelDefs) {
    const conn = await seedConnection({
      businessId,
      ownerId,
      provider: def.provider,
      authMethod: def.authMethod,
      externalAccountId: def.externalAccountId,
      displayName: def.displayName,
      accountType: def.accountType,
      purpose: def.purpose,
    })
    connByKey.set(def.externalAccountId, { id: conn.id, displayName: def.displayName })
  }

  const financeConn = await seedConnection({
    businessId,
    ownerId,
    provider: 'finapi',
    authMethod: 'api_key',
    externalAccountId: `demo:finapi:${firm.slug}`,
    displayName: `Bank · ${firm.name}`,
    accountType: 'finapi_platform',
    bindFinance: true,
  })

  const gmailInfo = [...connByKey.values()][0]!
  const whatsapp = [...connByKey.values()][1]!

  if (c0?.email) {
    const id = await seedIdentity({
      businessId,
      kind: 'email',
      value: c0.email,
      displayName: c0.displayName,
      customerId: c0.id,
    })
    await seedThread({
      businessId,
      connectionId: gmailInfo.id,
      channel: 'email',
      externalThreadId: `demo-mail-customer-${firm.slug}`,
      title: scripts.customerMail.title,
      identityId: id.id,
      assigneeUserId: ownerId,
      messages: scripts.customerMail.messages,
    })
  }

  {
    const leadEmail = `neu-${firm.slug}@interessent.example`
    const id = await seedIdentity({
      businessId,
      kind: 'email',
      value: leadEmail,
      displayName: 'Neue Anfrage',
      customerId: null,
      confidence: 'low',
    })
    await seedThread({
      businessId,
      connectionId: gmailInfo.id,
      channel: 'email',
      externalThreadId: `demo-mail-lead-${firm.slug}`,
      title: scripts.leadMail.title,
      identityId: id.id,
      assigneeUserId: null,
      messages: scripts.leadMail.messages,
    })
  }

  if (c0?.phone) {
    const id = await seedIdentity({
      businessId,
      kind: 'phone',
      value: c0.phone,
      displayName: c0.displayName,
      customerId: c0.id,
    })
    await seedThread({
      businessId,
      connectionId: whatsapp.id,
      channel: 'whatsapp',
      externalThreadId: `demo-wa-${firm.slug}-c0`,
      title: scripts.whatsapp.title,
      identityId: id.id,
      assigneeUserId: ownerId,
      unreadCount: 0,
      messages: scripts.whatsapp.messages,
    })
  }

  if (depth !== 'S') {
    const gmailBooking = [...connByKey.entries()].find(([k]) => k.includes('buchung'))?.[1]
    const tg = [...connByKey.entries()].find(([k]) => k.includes('tg-bot'))?.[1]
    const ig = [...connByKey.entries()].find(([k]) => k.includes(':ig:'))?.[1]

    if (gmailBooking && c1?.email && scripts.booking) {
      const id = await seedIdentity({
        businessId,
        kind: 'email',
        value: c1.email,
        displayName: c1.displayName,
        customerId: c1.id,
      })
      await seedThread({
        businessId,
        connectionId: gmailBooking.id,
        channel: 'email',
        externalThreadId: `demo-mail-booking-${firm.slug}`,
        title: scripts.booking.title,
        identityId: id.id,
        assigneeUserId: staffUserId,
        unreadCount: 0,
        messages: scripts.booking.messages,
      })
    }

    if (tg && scripts.telegram) {
      const id = await seedIdentity({
        businessId,
        kind: 'telegram_user',
        value: `tg:${firm.slug}:lead99`,
        displayName: 'Telegram Lead',
        customerId: null,
      })
      await seedThread({
        businessId,
        connectionId: tg.id,
        channel: 'telegram',
        externalThreadId: `demo-tg-${firm.slug}`,
        title: scripts.telegram.title,
        identityId: id.id,
        assigneeUserId: null,
        messages: scripts.telegram.messages,
      })
    }

    if (ig && c2 && scripts.instagram) {
      const id = await seedIdentity({
        businessId,
        kind: 'instagram',
        value: `@${(c2.displayName || 'fan').toLowerCase().replace(/\s+/g, '')}`,
        displayName: c2.displayName,
        customerId: c2.id,
        confidence: 'medium',
      })
      await seedThread({
        businessId,
        connectionId: ig.id,
        channel: 'instagram',
        externalThreadId: `demo-ig-${firm.slug}`,
        title: scripts.instagram.title,
        identityId: id.id,
        assigneeUserId: ownerId,
        messages: scripts.instagram.messages,
      })
    }
  }

  if (depth === 'L') {
    const outlook = [...connByKey.entries()].find(([k]) => k.includes('outlook'))?.[1]
    const tgUser = [...connByKey.entries()].find(([k]) => k.includes('tg-user'))?.[1]

    if (outlook && scripts.outlook) {
      const id = await seedIdentity({
        businessId,
        kind: 'email',
        value: `partner@billing-${firm.slug}.example`,
        displayName: 'CloudPay EU',
        customerId: c2?.id ?? null,
        confidence: c2 ? 'high' : 'medium',
      })
      await seedThread({
        businessId,
        connectionId: outlook.id,
        channel: 'email',
        externalThreadId: `demo-outlook-${firm.slug}`,
        title: scripts.outlook.title,
        identityId: id.id,
        status: 'open',
        assigneeUserId: staffUserId,
        messages: scripts.outlook.messages,
      })
    }

    if (tgUser && c1 && scripts.telegramUser) {
      const id = await seedIdentity({
        businessId,
        kind: 'telegram_user',
        value: `tg-user:${firm.slug}:${c1.id.slice(0, 8)}`,
        displayName: c1.displayName,
        customerId: c1.id,
      })
      await seedThread({
        businessId,
        connectionId: tgUser.id,
        channel: 'telegram_user',
        externalThreadId: `demo-tg-user-${firm.slug}`,
        title: scripts.telegramUser.title,
        identityId: id.id,
        assigneeUserId: ownerId,
        messages: scripts.telegramUser.messages,
      })
    }

    if (c0?.email && scripts.closed) {
      const id = await seedIdentity({
        businessId,
        kind: 'email',
        value: `alt-${c0.email}`,
        displayName: `${c0.displayName} (alt)`,
        customerId: c0.id,
      })
      await seedThread({
        businessId,
        connectionId: gmailInfo.id,
        channel: 'email',
        externalThreadId: `demo-mail-closed-${firm.slug}`,
        title: scripts.closed.title,
        identityId: id.id,
        status: 'closed',
        assigneeUserId: ownerId,
        unreadCount: 0,
        messages: scripts.closed.messages,
      })
    }
  }

  return { financeConnectionId: financeConn.id }
}
