/**
 * Resolve funnel data source for a business + surface (Metricool brand vs Direct).
 * Fail-closed when no brand linked — no cross-tenant env leak.
 * Location: apps/api/src/lib/funnel-source.ts
 */
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { businessIntegrations, funnelBindings } from '../db/schema.js'
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
  needs: 'key' | 'brand' | null
}

const ORGANIC_CHANNELS = new Set(['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube'])

export function organicSurface(channel: string): string {
  return `organic.${channel.toLowerCase()}`
}

export function isOrganicChannel(channel: string): boolean {
  return ORGANIC_CHANNELS.has(channel.toLowerCase())
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

  if (!keyReady) {
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

  let integ =
    integrationId != null
      ? linked.find((r) => r.id === integrationId) ?? null
      : null
  if (!integ && linked[0]) integ = linked[0]

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
    keyReady: true,
    brandsLinked,
    blogIds: [String(integ.externalId)],
    integrationId: integ.id,
    brandLabel: integ.label || integ.externalId,
    contentReady: true,
    needs: null,
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
