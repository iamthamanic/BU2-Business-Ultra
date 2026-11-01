/**
 * AdsPage — paid funnel campaigns; provider synced from `/marketing/funnel/paid/:channel`.
 * Location: apps/web/src/features/ads/AdsPage.tsx
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { companyRoutes } from '../../lib/companyPaths'
import { useI18n } from '../../lib/i18n'

const PROVIDERS = ['google_ads', 'meta_ads', 'tiktok_ads', 'chatgpt_ads'] as const
type Provider = (typeof PROVIDERS)[number]

const CHANNEL_TO_PROVIDER: Record<string, Provider> = {
  google: 'google_ads',
  meta: 'meta_ads',
  tiktok: 'tiktok_ads',
  chatgpt: 'chatgpt_ads',
}

const PROVIDER_TO_CHANNEL: Record<Provider, string> = {
  google_ads: 'google',
  meta_ads: 'meta',
  tiktok_ads: 'tiktok',
  chatgpt_ads: 'chatgpt',
}

function providerFromChannel(channel?: string): Provider {
  if (!channel) return 'google_ads'
  return CHANNEL_TO_PROVIDER[channel.toLowerCase()] || 'google_ads'
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
    const [c, r] = await Promise.all([
      api<{ campaigns: any[] }>(`/api/b/${slug}/ads`),
      api<{ ready: boolean }>(`/api/b/${slug}/integrations/${provider}/ready`),
    ])
    setCampaigns(c.campaigns)
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

  const title =
    provider === 'google_ads'
      ? t('googleAds')
      : provider === 'meta_ads'
        ? t('metaAds')
        : provider === 'tiktok_ads'
          ? t('tiktokAds')
          : t('chatgptAds')

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>{title}</h1>
      <p className="muted">{t('navPaid')} — key-gated live mode</p>
      <div className="panel stack">
        <select
          className="select"
          value={provider}
          onChange={(e) => onProviderChange(e.target.value as Provider)}
        >
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {p === 'google_ads'
                ? t('googleAds')
                : p === 'meta_ads'
                  ? t('metaAds')
                  : p === 'tiktok_ads'
                    ? t('tiktokAds')
                    : t('chatgptAds')}
            </option>
          ))}
        </select>
        <span className={`badge ${ready ? 'ok' : 'warn'}`}>{ready ? 'ready' : t('keyRequired')}</span>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Campaign name"
        />
        <button className="btn primary" disabled={!ready} onClick={create}>
          {t('save')}
        </button>
      </div>
      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
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
