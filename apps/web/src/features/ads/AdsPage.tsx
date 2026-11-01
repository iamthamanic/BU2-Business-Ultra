/**
 * AdsPage — paid funnel campaigns; provider synced from `/marketing/funnel/paid/:channel`.
 * LinkedIn Ads + Microsoft Ads are UI stubs until connectors land.
 * Location: apps/web/src/features/ads/AdsPage.tsx
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { companyRoutes } from '../../lib/companyPaths'
import { useI18n } from '../../lib/i18n'

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

const PROVIDER_TO_CHANNEL: Record<Provider, string> = {
  google_ads: 'google',
  meta_ads: 'meta',
  tiktok_ads: 'tiktok',
  chatgpt_ads: 'chatgpt',
  linkedin_ads: 'linkedin',
  microsoft_ads: 'microsoft',
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
  const navigate = useNavigate()
  const { t } = useI18n()
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [provider, setProvider] = useState<Provider>(() => providerFromChannel(channel))
  const [name, setName] = useState('')
  const [ready, setReady] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setProvider(providerFromChannel(channel))
  }, [channel])

  async function refresh() {
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
  }

  useEffect(() => {
    refresh().catch(console.error)
  }, [slug, provider])

  function onProviderChange(next: Provider) {
    setProvider(next)
    if (slug) {
      navigate(companyRoutes(slug).paid(PROVIDER_TO_CHANNEL[next]), { replace: true })
    }
  }

  async function create() {
    if (isStub(provider)) return
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

  if (isStub(provider)) {
    return (
      <div className="stack funnel-page">
        <header className="funnel-head">
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>
              {title}
            </h1>
            <p className="muted page-lede">{t('adsStubHint')}</p>
          </div>
          <span className="badge warn">{t('statusNeedKey')}</span>
        </header>
        <div className="panel">
          <p className="muted">{t('adsStubBody')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="stack funnel-page">
      <header className="funnel-head">
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            {title}
          </h1>
          <p className="muted page-lede">{t('navPaid')}</p>
        </div>
        <span className={`badge ${ready ? 'ok' : 'warn'}`}>{ready ? t('statusReady') : t('keyRequired')}</span>
      </header>
      <div className="panel stack">
        <select
          className="select"
          value={provider}
          onChange={(e) => onProviderChange(e.target.value as Provider)}
        >
          {[...LIVE_PROVIDERS, ...STUB_PROVIDERS].map((p) => (
            <option key={p} value={p}>
              {providerLabel(p, t)}
            </option>
          ))}
        </select>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('campaignNamePh')}
        />
        <button className="btn primary" disabled={!ready} onClick={create}>
          {t('save')}
        </button>
      </div>
      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>{t('name')}</th>
              <th>Provider</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.provider}</td>
                <td>{c.status}</td>
                <td>
                  <button className="btn" onClick={() => publish(c.id)}>
                    {t('publish')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg && <pre className="panel muted">{msg}</pre>}
    </div>
  )
}

function providerLabel(p: Provider, t: (k: 'googleAds' | 'metaAds' | 'tiktokAds' | 'chatgptAds' | 'linkedinAds' | 'microsoftAds') => string) {
  if (p === 'google_ads') return t('googleAds')
  if (p === 'meta_ads') return t('metaAds')
  if (p === 'tiktok_ads') return t('tiktokAds')
  if (p === 'chatgpt_ads') return t('chatgptAds')
  if (p === 'linkedin_ads') return t('linkedinAds')
  return t('microsoftAds')
}
