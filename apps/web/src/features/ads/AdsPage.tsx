/**
 * AdsPage — paid funnel campaigns; provider synced from `/marketing/funnel/paid/:channel`.
 * Campaigns table always visible; soft connect banner when key missing.
 * Location: apps/web/src/features/ads/AdsPage.tsx
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { companyRoutes } from '../../lib/companyPaths'
import { useI18n } from '../../lib/i18n'
import { FunnelConnectHint } from '../marketing/FunnelConnectHint'

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

  async function publish(id: string) {
    if (!confirm(t('confirmPublish'))) return
    try {
      const r = await api(`/api/b/${slug}/ads/${id}/publish`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      })
      setMsg(JSON.stringify(r))
      await refresh()
    } catch (e) {
      setMsg(String(e))
    }
  }

  const title = providerLabel(provider, t)
  const stub = isStub(provider)
  const showConnect = stub || (!loading && !ready)
  const emptyRow = stub
    ? t('adsStubBody')
    : !ready
      ? t('campaignsEmptyNeedKey')
      : t('noCampaigns')

  return (
    <div className="stack funnel-page">
      {showConnect ? (
        <FunnelConnectHint
          need={stub ? 'stub' : 'key'}
          settingsHref={settingsHref}
          message={stub ? t('adsStubBody') : t('connectBannerAds').replace('{provider}', title)}
        />
      ) : null}

      <div className="mkt-pane-toolbar">
        <p className="muted page-lede" style={{ margin: 0 }}>
          Connector: {title}
        </p>
        <div className="row funnel-gates">
          <span className={`badge ${ready && !stub ? 'ok' : 'warn'}`}>
            {ready && !stub ? t('statusReady') : t('keyRequired')}
          </span>
          <Link className="btn" to={settingsHref} style={{ fontSize: 12, padding: '4px 10px' }}>
            {t('openConnections')}
          </Link>
        </div>
      </div>

      <div className="panel stack">
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('campaignNamePh')}
          disabled={!ready || stub}
        />
        <button className="btn primary" type="button" onClick={create} disabled={!ready || stub}>
          {t('save')}
        </button>
      </div>

      <div className="panel">
        <h3 className="section-title" style={{ marginTop: 0 }}>
          {t('adsCampaigns')}
        </h3>
        <table className="table">
          <thead>
            <tr>
              <th>{t('name')}</th>
              <th>Provider</th>
              <th>{t('status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="funnel-table-empty muted">
                  {t('loading')}
                </td>
              </tr>
            ) : campaigns.length === 0 ? (
              <tr>
                <td colSpan={4} className="funnel-table-empty muted">
                  {emptyRow}
                </td>
              </tr>
            ) : (
              campaigns.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.provider}</td>
                  <td>{c.status}</td>
                  <td>
                    <button className="btn" type="button" onClick={() => publish(c.id)}>
                      {t('publish')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
