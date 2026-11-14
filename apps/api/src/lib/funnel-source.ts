/**
 * Resolve funnel data source for a business + surface (Metricool brand vs Direct).
 * Fail-closed when no brand/connection linked — no cross-tenant env leak.
 * Location: apps/api/src/lib/funnel-source.ts
 */
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { businessIntegrations, connections, funnelBindings } from '../db/schema.js'
import { getBusinessSecret } from './secrets.js'

export type FunnelSourceResult = {
  surface: string
  provider: string
  status: string
  implemented: boolean
  keyReady: boolean
  brandsLinked: number
  blogIds: string[]
  integrationId: string | null
  brandLabel: string | null
  message?: string
  /** Ready to show live/stub content chrome (key + brand for Metricool). */
  contentReady: boolean
  needs: 'key' | 'brand' | 'connection' | null
  /** Native Integration Core connection id when Direct is bound. */
  connectionId?: string | null
  connectionsLinked?: number
}

const ORGANIC_CHANNELS = new Set([
  'instagram',
  'facebook',
  'tiktok',
  'linkedin',
  'youtube',
  'x',
  'pinterest',
])

/** Funnel Direct provider id → Integration Core provider id. */
const DIRECT_TO_CONNECTION: Record<string, string> = {
  youtube: 'youtube',
  google_ads: 'google_ads',
  chatgpt_ads: 'chatgpt_ads',
  linkedin: 'linkedin',
  tiktok: 'tiktok',
  x: 'x',
  pinterest: 'pinterest',
}

export function organicSurface(channel: string): string {
  return `organic.${channel.toLowerCase()}`
}

export function isOrganicChannel(channel: string): boolean {
  return ORGANIC_CHANNELS.has(channel.toLowerCase())
}

async function countProviderConnections(businessId: string, provider: string) {
  const rows = await db
    .select()
    .from(connections)
    .where(and(eq(connections.businessId, businessId), eq(connections.provider, provider)))
  return rows.filter((r) => r.status === 'active')
}

export async function resolveFunnelSource(
  businessId: string,
  surface: string,
): Promise<FunnelSourceResult> {
  const metricoolSecret = await getBusinessSecret(businessId, 'metricool')
  const keyReady = !!(metricoolSecret && metricoolSecret.valid)

  const linked = await db
    .select()
    .from(businessIntegrations)
    .where(
      and(
        eq(businessIntegrations.businessId, businessId),
        eq(businessIntegrations.provider, 'metricool'),
      ),
    )
  const brandsLinked = linked.length

  const bind = (
    await db
      .select()
      .from(funnelBindings)
      .where(and(eq(funnelBindings.businessId, businessId), eq(funnelBindings.surface, surface)))
      .limit(1)
  )[0]

  let provider = bind?.provider || 'metricool'
  let status = bind?.status || 'active'
  let integrationId = bind?.integrationId || null

  // Direct connectors that use Integration Core OAuth connections.
  const connProvider = DIRECT_TO_CONNECTION[provider]
  if (connProvider && provider !== 'metricool') {
    const active = await countProviderConnections(businessId, connProvider)
    if (active.length === 0) {
      return {
        surface,
        provider,
        status: 'needs_connection',
        implemented: true,
        keyReady,
        brandsLinked,
        blogIds: [],
        integrationId: null,
        brandLabel: null,
        message: 'Native Verbindung in Settings → Verbindungen erforderlich',
        contentReady: false,
        needs: 'connection',
        connectionId: null,
        connectionsLinked: 0,
      }
    }
    const primary = active[0]!
    return {
      surface,
      provider,
      status: 'active',
      implemented: true,
      keyReady: true,
      brandsLinked,
      blogIds: [],
      integrationId: null,
      brandLabel: primary.displayName || primary.externalAccountId,
      contentReady: true,
      needs: null,
      connectionId: primary.id,
      connectionsLinked: active.length,
    }
  }

  if (provider !== 'metricool') {
    return {
      surface,
      provider,
      status: status === 'active' ? 'unavailable' : status,
      implemented: false,
      keyReady,
      brandsLinked,
      blogIds: [],
      integrationId,
      brandLabel: null,
      message: 'Connector demnächst',
      contentReady: false,
      needs: keyReady ? 'brand' : 'key',
    }
  }

  let integ =
    integrationId != null
      ? linked.find((r) => r.id === integrationId) ?? null
      : null
  if (!integ && linked[0]) integ = linked[0]

  const isDemoInteg = Boolean(
    integ &&
      integ.config &&
      typeof integ.config === 'object' &&
      (integ.config as { demo?: boolean }).demo === true,
  )

  if (!keyReady && !isDemoInteg) {
    return {
      surface,
      provider: 'metricool',
      status: 'needs_key',
      implemented: false,
      keyReady: false,
      brandsLinked,
      blogIds: [],
      integrationId: null,
      brandLabel: null,
      message: 'Metricool API-Key erforderlich',
      contentReady: false,
      needs: 'key',
    }
  }

  if (!integ) {
    return {
      surface,
      provider: 'metricool',
      status: 'unbound',
      implemented: false,
      keyReady: true,
      brandsLinked: 0,
      blogIds: [],
      integrationId: null,
      brandLabel: null,
      message: 'Keine Metricool-Brand verknüpft',
      contentReady: false,
      needs: 'brand',
    }
  }

  return {
    surface,
    provider: 'metricool',
    status: status || 'active',
    implemented: true,
    keyReady: keyReady || isDemoInteg,
    brandsLinked,
    blogIds: [String(integ.externalId)],
    integrationId: integ.id,
    brandLabel: integ.label || integ.externalId,
    contentReady: true,
    needs: null,
    message: isDemoInteg && !keyReady ? 'Demo-Metricool (ohne Live-Key)' : undefined,
  }
}

/** Legacy-shaped organic post row (live Metricool sync lands later). */
export type OrganicPostRow = {
  id: string
  date: string
  type: string
  bucket: string
  title: string
  url: string | null
  image: string | null
  views: number
  reach: number | null
  likes: number
  comments: number
  shares: number
  saves: number
  engagement: number | null
  durationSec: number | null
  watchPct: number | null
  paidShare: number | null
  sharesPer1000: number | null
  savesPer1000: number | null
  savesPer100: number | null
  kpiHit: boolean | null
}

export function emptyOrganicPosts(): OrganicPostRow[] {
  return []
}

/** Deterministic demo organic rows when Metricool live sync is absent. */
export function demoOrganicPosts(channel: string, brandLabel: string | null): OrganicPostRow[] {
  const ch = channel.toLowerCase()
  const label = brandLabel || 'Demo Brand'
  const base = [
    {
      title:
        ch === 'youtube'
          ? `${label}: Behind the scenes / Tutorial`
          : ch === 'linkedin'
            ? `${label}: Product note für Creator & Vereine`
            : `${label}: Launch / Angebot der Woche`,
      type: ch === 'youtube' ? 'video' : ch === 'instagram' ? 'reel' : 'post',
      daysAgo: 2,
      views: 4200,
      reach: 6100,
      likes: 310,
      comments: 28,
      shares: 44,
      saves: 67,
    },
    {
      title:
        ch === 'facebook'
          ? `${label}: Kundengeschichte / Social Proof`
          : `${label}: Tipps & Community-Frage`,
      type: 'post',
      daysAgo: 6,
      views: 1800,
      reach: 2400,
      likes: 120,
      comments: 19,
      shares: 22,
      saves: 31,
    },
    {
      title: `${label}: Story Highlight / Carousel`,
      type: ch === 'instagram' ? 'carousel' : 'post',
      daysAgo: 11,
      views: 950,
      reach: 1400,
      likes: 78,
      comments: 9,
      shares: 11,
      saves: 18,
    },
  ]
  return base.map((p, i) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - p.daysAgo)
    d.setUTCHours(d.getUTCHours() - (i + 1) * 3)
    const ageMs = Date.now() - d.getTime()
    const ageH = ageMs / 3_600_000
    const bucket = ageH <= 24 ? '24h' : ageH <= 24 * 7 ? '7d' : ageH <= 24 * 30 ? '30d' : 'older'
    const isVideo = p.type === 'video' || p.type === 'reel'
    const engagement = p.likes + p.comments + p.shares + p.saves
    const er =
      p.reach > 0 ? Math.round((engagement / p.reach) * 1000) / 10 : null
    return {
      id: `demo-${ch}-${i}`,
      date: d.toISOString(),
      type: p.type,
      bucket,
      title: p.title,
      url: null,
      image: null,
      views: p.views,
      reach: p.reach,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      saves: p.saves,
      engagement: er,
      durationSec: isVideo ? 28 + i * 7 : null,
      watchPct: isVideo ? 41 + i * 4 : null,
      paidShare: i === 0 ? 0.12 : 0,
      sharesPer1000: Math.round((p.shares / Math.max(p.views, 1)) * 1000),
      savesPer1000: Math.round((p.saves / Math.max(p.views, 1)) * 1000),
      savesPer100: Math.round((p.saves / Math.max(p.reach, 1)) * 100),
      kpiHit: engagement > 150,
    }
  })
}
