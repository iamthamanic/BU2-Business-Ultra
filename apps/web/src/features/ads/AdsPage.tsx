/**
 * AdsPage — paid funnel campaigns; provider synced from `/marketing/funnel/paid/:channel`.
 * Legacy chrome always visible (KPI strip + full table); soft connect banner when key missing.
 * Location: apps/web/src/features/ads/AdsPage.tsx
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { companyRoutes } from '../../lib/companyPaths'
import { useI18n } from '../../lib/i18n'
import { FunnelConnectHint } from '../marketing/FunnelConnectHint'
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
  const { t } = useI18n()
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [provider, setProvider] = useState<Provider>(() => providerFromChannel(channel))
  const [name, setName] = useState('')
  const [ready, setReady] = useState(false)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [win, setWin] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

  const settingsHref = slug ? companyRoutes(slug).settingsConnections : '#'

  useEffect(() => {
    setProvider(providerFromChannel(channel))
  }, [channel])

  async function refresh() {
    setLoading(true)
    try {
      if (isStub(provider)) {
        setCampaigns([])
        setReady(false)
        return
      }
      const [c, r] = await Promise.all([
        api<{ campaigns: any[] }>(`/api/b/${slug}/ads`),
        api<{ ready: boolean }>(`/api/b/${slug}/integrations/${provider}/ready`),
      ])
      setCampaigns(c.campaigns.filter((x) => x.provider === provider))
      setReady(r.ready)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh().catch(console.error)
  }, [slug, provider])

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
      campaigns.map((c) => ({
        id: String(c.id),
        name: String(c.name || '—'),
        notesCount: 0,
        adsConv: null,
        spendCents: typeof c.budgetDailyCents === 'number' ? null : null,
        impressions: null,
        clicks: null,
        ctr: null,
        cpcCents: null,
        cvr: null,
        cpaCents: null,
        roas: null,
        revenueCents: null,
        status: c.status ? String(c.status) : undefined,
      })),
    [campaigns],
  )

  return (
    <div className="stack funnel-page">
      {showConnect ? (
        <FunnelConnectHint
          need={stub ? 'stub' : 'key'}
          settingsHref={settingsHref}
          message={stub ? t('adsStubBody') : t('connectBannerAds')}
        />
      ) : null}

      <PaidCampaignsPanel
        channel={channel || provider}
        campaigns={loading ? [] : rows}
        emptyHint={emptyRow}
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
