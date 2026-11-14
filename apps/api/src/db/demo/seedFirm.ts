/**
 * Seed one demo firm with realistic cross-module data.
 * Location: apps/api/src/db/demo/seedFirm.ts
 */
import { eq } from 'drizzle-orm'
import { sealSecret } from '../../lib/crypto.js'
import { seedDefaultAreaProjects } from '../../modules/projects/defaultAreas.js'
import { db } from '../client.js'
import {
  adsCampaigns,
  brevoCampaigns,
  businessIntegrations,
  businesses,
  connectionCredentials,
  connections,
  contacts,
  customerNotes,
  customerPurchases,
  financeAccounts,
  financeSettings,
  financeTransactions,
  funnelBindings,
  memberships,
  moduleBindings,
  personas,
  products,
  projects,
  socialDrafts,
  tasks,
  users,
} from '../schema.js'
import {
  areaTasksFor,
  buildJourneyMap,
  catalogFor,
  contactCountForDepth,
  productCountForDepth,
} from './firmCatalog.js'
import { DEMO_MARKER, type DemoFirm } from './firms.js'
import { seedCrmLivingHistory } from './seedCrmLiving.js'
import { seedInboxBundle } from './seedInbox.js'

function daysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function isoDaysAgo(n: number): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

async function ensureTeamUser(email: string, displayName: string) {
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existing[0]) return existing[0]
  const id = crypto.randomUUID()
  const [row] = await db
    .insert(users)
    .values({
      id,
      email,
      displayName,
      locale: 'de',
      isSuperadmin: false,
      isBreakglassOperator: false,
      emailVerified: true,
    })
    .returning()
  return row!
}

async function seedMarketingConnection(opts: {
  businessId: string
  ownerId: string
  provider: string
  displayName: string
  externalAccountId: string
}) {
  const sealed = sealSecret(`demo:mkt:${opts.provider}:${DEMO_MARKER}`)
  const [conn] = await db
    .insert(connections)
    .values({
      businessId: opts.businessId,
      provider: opts.provider,
      authMethod: opts.provider.includes('ads') || opts.provider === 'tiktok_ads' ? 'api_key' : 'oauth_pkce',
      externalAccountId: opts.externalAccountId,
      displayName: opts.displayName,
      status: 'active',
      accountType: opts.provider,
      health: { ok: true, note: DEMO_MARKER, checkedAt: new Date().toISOString() },
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
  await db.insert(moduleBindings).values({
    businessId: opts.businessId,
    connectionId: conn!.id,
    module: 'marketing',
    purpose: 'publish',
    enabled: true,
  })
  return conn!
}

export async function seedFirm(firm: DemoFirm, ownerId: string): Promise<string> {
  const pack = catalogFor(firm)
  const [biz] = await db
    .insert(businesses)
    .values({
      name: firm.name,
      slug: firm.slug,
      status: 'active',
      createdByUserId: ownerId,
      styleguide: { demo: true, marker: DEMO_MARKER, depth: firm.depth },
    })
    .returning()
  const businessId = biz!.id

  await db.insert(memberships).values({
    businessId,
    userId: ownerId,
    isOwner: true,
    status: 'active',
  })
  const { seedSystemBundles } = await import('../../lib/authorize.js')
  await seedSystemBundles(businessId)

  const staffName =
    firm.slug === 'wendy-spirit'
      ? 'Wendy Hofmann'
      : firm.slug === 'physiopraxis-hammer'
        ? 'Lara Berger'
        : 'Niklas Hartwig'
  const editor = await ensureTeamUser(`demo+${firm.slug}-editor@bu2.local`, staffName)
  // Ensure display name stays realistic if the demo user already existed.
  if (editor.displayName !== staffName) {
    await db.update(users).set({ displayName: staffName }).where(eq(users.id, editor.id))
    editor.displayName = staffName
  }
  await db.insert(memberships).values({
    businessId,
    userId: editor.id,
    isOwner: false,
    status: 'active',
  })

  if (firm.depth !== 'S') {
    const assistName =
      firm.slug === 'physiopraxis-hammer' ? 'Tom Klein' : 'Mira Oswald'
    const viewer = await ensureTeamUser(
      `demo+${firm.slug}-assistenz@bu2.local`,
      assistName,
    )
    if (viewer.displayName !== assistName) {
      await db.update(users).set({ displayName: assistName }).where(eq(users.id, viewer.id))
    }
    await db.insert(memberships).values({
      businessId,
      userId: viewer.id,
      isOwner: false,
      status: 'active',
    })
  }

  await seedDefaultAreaProjects(businessId, ownerId)

  // ── Contacts ──────────────────────────────────────────────
  const contactSlice = pack.contacts.slice(0, contactCountForDepth(firm.depth, pack.contacts.length))
  const seededContacts: { id: string; displayName: string; email: string | null; phone: string | null }[] =
    []
  let custNo = 100100
  let partNo = 100100
  for (const c of contactSlice) {
    const [row] = await db
      .insert(contacts)
      .values({
        businessId,
        isCustomer: c.isCustomer,
        isPartner: c.isPartner,
        partnerCategory: c.partnerCategory ?? null,
        partnerStatus: 'active',
        customerNumber: c.isCustomer ? custNo++ : null,
        partnerNumber: c.isPartner ? partNo++ : null,
        kind: c.kind,
        displayName: c.displayName,
        email: c.email,
        phone: c.phone,
        city: c.city,
        country: 'Deutschland',
        relationStatus: c.relationStatus,
        tags: [...c.tags, DEMO_MARKER],
      })
      .returning()
    seededContacts.push({
      id: row!.id,
      displayName: c.displayName,
      email: c.email,
      phone: c.phone,
    })
    await db.insert(customerNotes).values({
      customerId: row!.id,
      authorUserId: ownerId,
      body: c.note,
    })
    if (firm.depth !== 'S') {
      await db.insert(customerNotes).values({
        customerId: row!.id,
        authorUserId: editor.id,
        body: `Follow-up notiert (${firm.name}): nächster Kontaktkanal laut Präferenz prüfen.`,
      })
    }
  }

  // ── Personas + Products ───────────────────────────────────
  const productSlice = pack.products.slice(0, productCountForDepth(firm.depth, pack.products.length))
  const productIds: string[] = []
  const productNames: string[] = []

  for (const p of productSlice) {
    const [persona] = await db
      .insert(personas)
      .values({
        businessId,
        name: p.persona.name,
        summary: p.persona.jobToBeDone,
        goals: [p.persona.jobToBeDone],
        pains: p.persona.pains,
        channels: ['instagram', 'email', 'whatsapp'],
        journey: Object.entries(p.journeyItems).map(([k, v]) => ({ phase: k, items: v })),
      })
      .returning()

    const costPositions = p.costs.map((c, i) => ({
      id: `cost-${firm.slug}-${productIds.length}-${i}`,
      dept: c.dept,
      label: c.label,
      amountCents: c.amountCents,
      enabled: true,
      note: c.note,
    }))

    const journeyMap = buildJourneyMap(p.journeyItems)
    const [prod] = await db
      .insert(products)
      .values({
        businessId,
        name: p.name,
        description: p.description,
        market: p.market,
        currency: 'EUR',
        sellingPriceCents: p.sellingPriceCents,
        priceKind: 'gross',
        taxRateBps: 1900,
        costPositions,
        personaIds: [persona!.id],
        personaDraft: {
          name: p.persona.name,
          role: p.persona.role,
          gender: 'open',
          ageGroup: p.persona.ageGroup,
          incomeGroup: 'open',
          revenueBand: 'open',
          headcount: 'open',
          roles: [p.persona.role],
          pains: p.persona.pains,
          vocabulary: p.persona.vocabulary,
          jobToBeDone: p.persona.jobToBeDone,
        },
        journeyCanvas: {
          nodes: [
            { id: 'n-product', kind: 'product', label: p.name, x: 80, y: 120 },
            {
              id: 'n-persona',
              kind: 'persona',
              label: p.persona.name,
              x: 320,
              y: 120,
              refId: persona!.id,
            },
            { id: 'n-stage-a', kind: 'stage', label: 'Aufmerksamkeit', x: 80, y: 280 },
            { id: 'n-stage-c', kind: 'stage', label: 'Kauf', x: 320, y: 280 },
            { id: 'n-stage-d', kind: 'stage', label: 'Erfüllung', x: 560, y: 280 },
          ],
          edges: [
            { id: 'e1', source: 'n-persona', target: 'n-product' },
            { id: 'e2', source: 'n-stage-a', target: 'n-stage-c' },
            { id: 'e3', source: 'n-stage-c', target: 'n-stage-d' },
          ],
          map: journeyMap,
        },
      })
      .returning()
    productIds.push(prod!.id)
    productNames.push(p.name)

    // Attach first matching customer to this buyer persona (realistic CRM link).
    const customerTarget = seededContacts.find((_, idx) => contactSlice[idx]?.isCustomer)
    if (customerTarget && productIds.length === 1) {
      await db
        .update(contacts)
        .set({ buyerPersonaId: persona!.id })
        .where(eq(contacts.id, customerTarget.id))
    }
  }

  // Purchases
  if (seededContacts[0] && productIds[0]) {
    await db.insert(customerPurchases).values({
      businessId,
      customerId: seededContacts[0].id,
      productId: productIds[0],
      label: productNames[0]!,
      amountCents: productSlice[0]!.sellingPriceCents,
      currency: 'EUR',
      purchasedAt: isoDaysAgo(12),
    })
  }
  if (firm.depth !== 'S' && seededContacts[1] && productIds[1]) {
    await db.insert(customerPurchases).values({
      businessId,
      customerId: seededContacts.find((c) => c.email === pack.contacts[0]?.email)?.id
        ? seededContacts[Math.min(2, seededContacts.length - 1)]!.id
        : seededContacts[1]!.id,
      productId: productIds[1],
      label: productNames[1]!,
      amountCents: productSlice[1]!.sellingPriceCents,
      currency: 'EUR',
      purchasedAt: isoDaysAgo(4),
    })
  }
  if (firm.depth === 'L' && seededContacts[3] && productIds[0]) {
    await db.insert(customerPurchases).values([
      {
        businessId,
        customerId: seededContacts[3].id,
        productId: productIds[0],
        label: `${productNames[0]} × 3`,
        amountCents: productSlice[0]!.sellingPriceCents * 3,
        currency: 'EUR',
        purchasedAt: isoDaysAgo(30),
      },
      {
        businessId,
        customerId: seededContacts[0]!.id,
        productId: productIds[Math.min(2, productIds.length - 1)]!,
        label: productNames[Math.min(2, productNames.length - 1)]!,
        amountCents: productSlice[Math.min(2, productSlice.length - 1)]!.sellingPriceCents,
        currency: 'EUR',
        purchasedAt: isoDaysAgo(8),
      },
    ])
  }

  // ── Projects + tasks ──────────────────────────────────────
  const projectRows: { id: string; name: string }[] = []
  for (const proj of pack.projects) {
    const [pr] = await db
      .insert(projects)
      .values({
        businessId,
        type: 'custom',
        name: proj.name,
        description: proj.description,
        ownerUserId: ownerId,
        memberUserIds: [editor.id],
        status: 'active',
        startAt: isoDaysAgo(25),
        dueAt: isoDaysAgo(-21),
      })
      .returning()
    projectRows.push({ id: pr!.id, name: proj.name })

    for (const t of proj.tasks) {
      const status =
        t.status === 'done' ? 'done' : t.status === 'in_progress' ? 'in_progress' : 'open'
      await db.insert(tasks).values({
        businessId,
        projectId: pr!.id,
        customerId: seededContacts[0]?.id ?? null,
        title: t.title,
        description: t.description,
        status,
        priority:
          t.priority === 'p0' || t.priority === 'high'
            ? 'high'
            : t.priority === 'low'
              ? 'low'
              : 'medium',
        assigneeUserId: t.priority === 'high' || t.priority === 'p0' ? ownerId : editor.id,
        dueAt: isoDaysAgo(t.daysDue),
      })
    }
  }

  const areaProjects = await db
    .select({ id: projects.id, area: projects.area })
    .from(projects)
    .where(eq(projects.businessId, businessId))
  const areaByKey = new Map(
    areaProjects.filter((p) => p.area).map((p) => [p.area as string, p.id]),
  )
  for (const t of areaTasksFor(firm)) {
    const projectId = areaByKey.get(t.area) ?? null
    await db.insert(tasks).values({
      businessId,
      projectId,
      customerId: seededContacts[0]?.id ?? null,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      assigneeUserId: t.priority === 'high' ? ownerId : editor.id,
      dueAt: isoDaysAgo(t.daysDue),
    })
  }

  await db.insert(tasks).values({
    businessId,
    projectId: areaByKey.get('kunden') ?? null,
    title: `Inbox nachziehen · ${firm.name}`,
    description: 'Offene Anfragen aus E-Mail/WhatsApp/Social heute beantworten.',
    status: 'open',
    priority: 'high',
    assigneeUserId: editor.id,
    dueAt: isoDaysAgo(-1),
  })

  // ── Marketing connections + content ───────────────────────
  const mktProviders =
    firm.depth === 'S'
      ? (['instagram', 'facebook'] as const)
      : firm.depth === 'M'
        ? (['instagram', 'facebook', 'google_ads', 'youtube'] as const)
        : (['instagram', 'facebook', 'youtube', 'google_ads', 'meta_ads', 'tiktok_ads'] as const)

  for (const provider of mktProviders) {
    await seedMarketingConnection({
      businessId,
      ownerId,
      provider,
      displayName: `${provider} · ${firm.name}`,
      externalAccountId: `demo:mkt:${provider}:${firm.slug}`,
    })
  }

  const [metricool] = await db
    .insert(businessIntegrations)
    .values({
      businessId,
      provider: 'metricool',
      externalId: `demo-metricool-${firm.slug}`,
      label: `Metricool · ${firm.name}`,
      config: { demo: true, marker: DEMO_MARKER },
    })
    .returning()

  const organicSurfaces =
    firm.depth === 'S'
      ? (['organic.instagram', 'organic.facebook'] as const)
      : firm.depth === 'M'
        ? (['organic.instagram', 'organic.facebook', 'organic.youtube'] as const)
        : ([
            'organic.instagram',
            'organic.facebook',
            'organic.youtube',
            'organic.tiktok',
            'organic.linkedin',
          ] as const)
  const paidSurfaces =
    firm.depth === 'S'
      ? ([] as const)
      : firm.depth === 'M'
        ? (['paid.google', 'paid.meta'] as const)
        : (['paid.google', 'paid.meta', 'paid.tiktok'] as const)
  await db.insert(funnelBindings).values(
    [...organicSurfaces, ...paidSurfaces].map((surface) => ({
      businessId,
      surface,
      provider: 'metricool',
      integrationId: metricool!.id,
      status: 'active' as const,
    })),
  )

  for (const draft of pack.marketing.drafts) {
    await db.insert(socialDrafts).values({
      businessId,
      title: draft.title,
      masterText: draft.masterText,
      variants: draft.variants.map((v) => ({
        network: v.network,
        text: v.text,
        enabled: true,
      })),
      remoteStatus: { demo: true, scheduledHint: 'demo' },
      createdByUserId: ownerId,
    })
  }

  const adsSlice =
    firm.depth === 'S'
      ? pack.marketing.ads.slice(0, 1)
      : firm.depth === 'M'
        ? pack.marketing.ads.slice(0, 2)
        : pack.marketing.ads
  for (const [i, ad] of adsSlice.entries()) {
    const daily = ad.budgetDailyCents || 3000
    const days = firm.depth === 'S' ? 14 : firm.depth === 'M' ? 21 : 30
    const spendCents = Math.round(daily * days * (0.55 + (i % 3) * 0.12))
    const impressions = 12_000 + i * 8_500 + daily
    const clicks = Math.round(impressions * (0.018 + i * 0.004))
    const conv = Math.max(1, Math.round(clicks * (0.04 + i * 0.01)))
    const revenueCents = Math.round(conv * (productSlice[0]?.sellingPriceCents ?? 4900) * 0.9)
    const ctr = impressions > 0 ? clicks / impressions : 0
    const cpcCents = clicks > 0 ? Math.round(spendCents / clicks) : null
    const cvr = clicks > 0 ? conv / clicks : 0
    const cpaCents = conv > 0 ? Math.round(spendCents / conv) : null
    const roas = spendCents > 0 ? revenueCents / spendCents : null
    await db.insert(adsCampaigns).values({
      businessId,
      provider: ad.provider,
      name: ad.name,
      budgetDailyCents: ad.budgetDailyCents,
      objective: ad.objective,
      status: ad.status,
      createdByUserId: ownerId,
      payload: {
        demo: true,
        marker: DEMO_MARKER,
        metrics: {
          windowDays: days,
          spendCents,
          impressions,
          clicks,
          ctr,
          cpcCents,
          adsConv: conv,
          cvr,
          cpaCents,
          revenueCents,
          roas,
        },
      },
    })
  }

  const brevoSlice = firm.depth === 'S' ? pack.marketing.brevo.slice(0, 1) : pack.marketing.brevo
  for (const mail of brevoSlice) {
    await db.insert(brevoCampaigns).values({
      businessId,
      name: mail.name,
      subject: mail.subject,
      htmlContent: mail.html,
      status: mail.status,
      createdByUserId: ownerId,
    })
  }

  // ── Inbox multi-channel ───────────────────────────────────
  const { financeConnectionId } = await seedInboxBundle({
    firm,
    businessId,
    ownerId,
    staffUserId: editor.id,
    contacts: seededContacts,
  })

  // ── Finance ───────────────────────────────────────────────
  const balance =
    firm.depth === 'S' ? 4_250_00 : firm.depth === 'M' ? 28_900_00 : 186_400_00
  const ibanDigits = String(
    370400440532013000n + BigInt([...firm.slug].reduce((a, c) => a + c.charCodeAt(0), 0) * 97),
  ).slice(0, 18)
  const [account] = await db
    .insert(financeAccounts)
    .values({
      businessId,
      name: firm.depth === 'L' ? 'Geschäftskonto Haupt' : 'Geschäftskonto',
      iban: `DE89${ibanDigits}`,
      bankName: 'Demo Bank AG',
      currency: 'EUR',
      balanceCents: balance,
      connectionId: financeConnectionId,
      source: 'demo',
    })
    .returning()

  if (firm.depth === 'L') {
    await db.insert(financeAccounts).values({
      businessId,
      name: 'Steuer-Rücklage',
      iban: null,
      bankName: 'Demo Bank AG',
      currency: 'EUR',
      balanceCents: 42_000_00,
      connectionId: financeConnectionId,
      source: 'demo',
    })
  }

  await db.insert(financeSettings).values({
    businessId,
    taxReserveCents: firm.depth === 'S' ? 800_00 : firm.depth === 'M' ? 4_500_00 : 22_000_00,
    opsBufferCurrentCents: firm.depth === 'S' ? 500_00 : firm.depth === 'M' ? 3_000_00 : 12_000_00,
    opsBufferTargetCents: firm.depth === 'S' ? 1_200_00 : firm.depth === 'M' ? 6_000_00 : 25_000_00,
  })

  const txCount = firm.depth === 'S' ? 8 : firm.depth === 'M' ? 18 : 36
  const projectLabel = projectRows[0]?.name ?? 'Allgemein'
  const txRows = []
  for (let i = 0; i < txCount; i++) {
    const income = i % 3 !== 1
    const pname = productNames[i % Math.max(productNames.length, 1)] ?? 'Leistung'
    txRows.push({
      businessId,
      accountId: account!.id,
      bookedOn: daysAgo(txCount - i),
      name: income
        ? `Eingang · ${pname}`
        : i % 5 === 0
          ? firm.slug === 'sagatree-vtt'
            ? 'AWS / Hosting'
            : 'Miete / Betrieb'
          : 'Betriebsausgabe',
      description: `Demo-Buchung (${DEMO_MARKER})`,
      category: income ? 'Umsatz' : i % 5 === 0 ? 'Infrastruktur' : 'Sonstiges',
      projectLabel,
      contactId: income && seededContacts.length ? seededContacts[i % seededContacts.length]!.id : null,
      status: i === txCount - 1 ? 'planned' : i === txCount - 2 ? 'overdue' : 'paid',
      kind: income ? ('income' as const) : ('expense' as const),
      source: 'demo',
      amountCents: income
        ? (productSlice[i % productSlice.length]?.sellingPriceCents ?? 12000) + i * 50
        : 3500 + i * 120,
      recurring: !income && i % 5 === 0,
      externalId: `demo-tx-${firm.slug}-${i}`,
    })
  }
  await db.insert(financeTransactions).values(txRows)

  // CRM timeline mirrors inbox + notes + purchases + consents
  await seedCrmLivingHistory({
    businessId,
    ownerId,
    staffUserId: editor.id,
    contactIds: seededContacts.map((c) => c.id),
  })

  // Brand styleguide so Marketing → Styleguide is not empty chrome
  await db
    .update(businesses)
    .set({
      styleguide: {
        demo: true,
        marker: DEMO_MARKER,
        depth: firm.depth,
        version: 1,
        lede: `${firm.name} — Markenleitplanken für Content & Ads.`,
        heroMeta: firm.depth === 'L' ? 'SaaS · B2C/B2B' : 'Lokal · Service',
        companySub: 'Über uns',
        companyBody1: `${firm.name} nutzt Business Ultra als Betriebssystem für CRM, Inbox und Marketing.`,
        typeDisplay: 'Söhne',
        typeBody: 'Inter',
        colors: [
          { id: 'primary', hex: '#0ea5e9', role: 'Primary' },
          { id: 'accent', hex: '#22c55e', role: 'Accent' },
          { id: 'ink', hex: '#0f172a', role: 'Ink' },
        ],
        dos: ['Klarer Nutzen im ersten Satz', 'Echte Kundennamen nur mit Freigabe'],
        donts: ['Stock-Smileys als Hero', 'Übertriebene Rabatt-Schreierei'],
      },
    })
    .where(eq(businesses.id, businessId))

  return businessId
}
