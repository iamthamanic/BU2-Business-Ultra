import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

const PROVIDERS = ['google_ads', 'meta_ads', 'tiktok_ads', 'chatgpt_ads'] as const

export function AdsPage() {
  const { slug } = useParams()
  const { t } = useI18n()
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]>('chatgpt_ads')
  const [name, setName] = useState('')
  const [ready, setReady] = useState(false)
  const [msg, setMsg] = useState('')

  async function refresh() {
    const [c, r] = await Promise.all([
      api<{ campaigns: any[] }>(`/api/b/${slug}/ads`),
      api<{ ready: boolean }>(`/api/b/${slug}/integrations/${provider}/ready`),
    ])
    setCampaigns(c.campaigns)
    setReady(r.ready)
  }

  useEffect(() => { refresh().catch(console.error) }, [slug, provider])

  async function create() {
    try {
      await api(`/api/b/${slug}/ads`, {
        method: 'POST',
        body: JSON.stringify({ provider, name, budgetDailyCents: 1000, objective: 'traffic', payload: {} }),
      })
      setName('')
      await refresh()
    } catch (e) {
      setMsg(String(e))
    }
  }

  async function publish(id: string) {
    if (!confirm('Confirm paid ads publish?')) return
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

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>{t('ads')}</h1>
      <p className="muted">Google / Meta / TikTok / ChatGPT Ads — key-gated live mode</p>
      <div className="panel stack">
        <select className="select" value={provider} onChange={(e) => setProvider(e.target.value as any)}>
          {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <span className={`badge ${ready ? 'ok' : 'warn'}`}>{ready ? 'ready' : t('keyRequired')}</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name" />
        <button className="btn primary" disabled={!ready} onClick={create}>{t('save')}</button>
      </div>
      <div className="panel">
        <table className="table">
          <thead><tr><th>Name</th><th>Provider</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.provider}</td>
                <td>{c.status}</td>
                <td><button className="btn" onClick={() => publish(c.id)}>{t('publish')}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg && <pre className="panel muted">{msg}</pre>}
    </div>
  )
}
