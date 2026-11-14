/**
 * AdsPage — paid funnel campaigns; provider synced from `/marketing/funnel/paid/:channel`.
 * Analyse: KPI strip + table · Planung (`…/planung`): calendar reuse.
 * Location: apps/web/src/features/ads/AdsPage.tsx
 */
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { companyRoutes, parseMarketingLocation } from '../../lib/companyPaths'
import { useI18n } from '../../lib/i18n'
import { FunnelConnectHint } from '../marketing/FunnelConnectHint'
import { OrganicProductionPanel } from '../marketing/OrganicProductionPanel'
import { PaidCampaignsPanel, type PaidCampaignRow } from './PaidCampaignsPanel'

const LIVE_PROVIDERS = ['google_ads', 'meta_ads', 'tiktok_ads', 'chatgpt_ads'] as const
const STUB_PROVIDERS = ['linkedin_ads', 'microsoft_ads'] as const
type LiveProvider = (typeof LIVE_PROVIDERS)[number]
type StubProvider = (typeof STUB_PROVIDERS)[number]
type Provider = LiveProvider | StubProvider

const CHANNEL_TO_PROVIDER: Record<string, Provider> = {
  google: 'google_ads',
  meta: 'meta_ads',
  tiktok: 'tiktok_ads',
  chatgpt: 'chatgpt_ads',
  linkedin: 'linkedin_ads',
  microsoft: 'microsoft_ads',
}

function providerFromChannel(channel?: string): Provider {
  if (!channel) return 'meta_ads'
  return CHANNEL_TO_PROVIDER[channel.toLowerCase()] || 'meta_ads'
}

function isStub(p: Provider): p is StubProvider {
  return (STUB_PROVIDERS as readonly string[]).includes(p)
}

export function AdsPage() {
  const { slug, channel } = useParams()
  const { pathname } = useLocation()
  const { t } = useI18n()
  const parsed = useMemo(() => parseMarketingLocation(pathname), [pathname])
  const isPlanung = parsed.surface === 'planung'

  const [campaigns, setCampaigns] = useState<any[]>([])
  const [provider, setProvider] = useState<Provider>(() => providerFromChannel(channel))
  const [name, setName] = useState('')
  const [ready, setReady] = useState(false)
  const [connectNeed, setConnectNeed] = useState<'key' | 'connection' | 'stub'>('key')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [win, setWin] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

  const settingsHref = slug ? companyRoutes(slug).settingsConnections : '#'

  useEffect(() => {
    if (!isPlanung) setProvider(providerFromChannel(channel))
  }, [channel, isPlanung])

  async function refresh() {
    if (isPlanung) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      if (isStub(provider)) {
        setCampaigns([])
        setReady(false)
        setConnectNeed('stub')
        return
      }

      // Native Google Ads OAuth path when Funnel Direct is selected.
      if (provider === 'google_ads') {
        const src = await api<{
          provider: string
          contentReady: boolean
          needs: 'key' | 'brand' | 'connection' | null
          connectionId?: string | null
        }>(`/api/b/${slug}/marketing/funnel-source/${encodeURIComponent('paid.google')}`)
        if (src.provider === 'google_ads') {
          if (!src.contentReady || !src.connectionId) {
            setCampaigns([])
            setReady(false)
            setConnectNeed(src.needs === 'connection' ? 'connection' : 'key')
            return
          }
          try {
            const live = await api<{ campaigns: Array<{ id: string; name: string; status: string }> }>(
              `/api/b/${slug}/integrations/google-ads/connections/${src.connectionId}/campaigns`,
            )
            setCampaigns(
              live.campaigns.map((c) => ({
                id: c.id,
                name: c.name,
                status: c.status,
                provider: 'google_ads',
                budgetDailyCents: null,
              })),
            )
            setReady(true)
            setConnectNeed('key')
            return
          } catch {
            setCampaigns([])
            setReady(false)
            setConnectNeed('connection')
            return
          }
        }
      }

      const [c, r] = await Promise.all([
        api<{ campaigns: any[] }>(`/api/b/${slug}/ads`),
        api<{ ready: boolean }>(`/api/b/${slug}/integrations/${provider}/ready`),
      ])
      const forProvider = c.campaigns.filter((x) => x.provider === provider)
      const hasDemoMetrics = forProvider.some((x) => {
        const payload = x.payload as { demo?: boolean; metrics?: Record<string, unknown> } | null
        return Boolean(payload?.demo && payload.metrics)
      })
      setCampaigns(forProvider)
      setReady(r.ready || hasDemoMetrics)
      setConnectNeed('key')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh on route/provider
  }, [slug, provider, isPlanung])

  async function create() {
    if (isStub(provider) || !ready) return
    try {
      await api(`/api/b/${slug}/ads`, {
        method: 'POST',
        body: JSON.stringify({
          provider,
          name,
          budgetDailyCents: 1000,
          objective: 'traffic',
          payload: {},
        }),
      })
      setName('')
      await refresh()
    } catch (e) {
      setMsg(String(e))
    }
  }

  const title = providerLabel(provider, t)
  const stub = isStub(provider)
  const showConnect = stub || (!loading && !ready)
  const emptyRow = loading
    ? t('loading')
    : stub
      ? t('adsStubBody')
      : !ready
        ? t('campaignsEmptyNeedKey')
        : t('noCampaignsInWindow')

  const rows: PaidCampaignRow[] = useMemo(
    () =>
      campaigns.map((c) => {
        const metrics = readCampaignMetrics(c.payload)
        return {
          id: String(c.id),
          name: String(c.name || '—'),
          notesCount: 0,
          adsConv: metrics.adsConv,
          spendCents: metrics.spendCents,
          impressions: metrics.impressions,
          clicks: metrics.clicks,
          ctr: metrics.ctr,
          cpcCents: metrics.cpcCents,
          cvr: metrics.cvr,
          cpaCents: metrics.cpaCents,
          roas: metrics.roas,
          revenueCents: metrics.revenueCents,
          status: c.status ? String(c.status) : undefined,
        }
      }),
    [campaigns],
  )

  if (isPlanung) {
    return (
      <div className="stack funnel-page">
        <OrganicProductionPanel />
      </div>
    )
  }

  return (
    <div className="stack funnel-page">
      <PaidCampaignsPanel
        channel={channel || provider}
        campaigns={loading ? [] : rows}
        emptyHint={emptyRow}
        emptyContent={
          showConnect ? (
            <FunnelConnectHint
              need={stub ? 'stub' : connectNeed}
              settingsHref={settingsHref}
              message={
                stub
                  ? t('adsStubBody')
                  : connectNeed === 'connection'
                    ? t('connectBannerConnection')
                    : t('connectBannerAds')
              }
            />
          ) : undefined
        }
        initialWindow={win}
        onWindowChange={setWin}
      />

      {!stub ? (
        <details className="panel funnel-secondary">
          <summary className="funnel-secondary-summary">{t('adsManualCreate')}</summary>
          <div className="stack" style={{ marginTop: 12 }}>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('campaignNamePh')}
              disabled={!ready}
            />
            <button className="btn primary" type="button" onClick={create} disabled={!ready || !name.trim()}>
              {t('save')}
            </button>
          </div>
        </details>
      ) : null}

      {msg ? <pre className="panel muted">{msg}</pre> : null}
    </div>
  )
}

function providerLabel(
  p: Provider,
  t: (
    k:
      | 'googleAds'
      | 'metaAds'
      | 'tiktokAds'
      | 'chatgptAds'
      | 'linkedinAds'
      | 'microsoftAds',
  ) => string,
) {
  if (p === 'google_ads') return t('googleAds')
  if (p === 'meta_ads') return t('metaAds')
  if (p === 'tiktok_ads') return t('tiktokAds')
  if (p === 'chatgpt_ads') return t('chatgptAds')
  if (p === 'linkedin_ads') return t('linkedinAds')
  return t('microsoftAds')
}

type CampaignMetrics = {
  adsConv: number | null
  spendCents: number | null
  impressions: number | null
  clicks: number | null
  ctr: number | null
  cpcCents: number | null
  cvr: number | null
  cpaCents: number | null
  roas: number | null
  revenueCents: number | null
}

function readCampaignMetrics(payload: unknown): CampaignMetrics {
  const empty: CampaignMetrics = {
    adsConv: null,
    spendCents: null,
    impressions: null,
    clicks: null,
    ctr: null,
    cpcCents: null,
    cvr: null,
    cpaCents: null,
    roas: null,
    revenueCents: null,
  }
  if (!payload || typeof payload !== 'object') return empty
  const metrics = (payload as { metrics?: Record<string, unknown> }).metrics
  if (!metrics || typeof metrics !== 'object') return empty
  const num = (k: string): number | null => {
    const v = metrics[k]
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  }
  const ctr = num('ctr')
  const cvr = num('cvr')
  // Payload stores ratios (0–1); table fmtPct expects percent points.
  return {
    adsConv: num('adsConv'),
    spendCents: num('spendCents'),
    impressions: num('impressions'),
    clicks: num('clicks'),
    ctr: ctr != null ? (ctr <= 1 ? ctr * 100 : ctr) : null,
    cpcCents: num('cpcCents'),
    cvr: cvr != null ? (cvr <= 1 ? cvr * 100 : cvr) : null,
    cpaCents: num('cpaCents'),
    roas: num('roas'),
    revenueCents: num('revenueCents'),
  }
}
