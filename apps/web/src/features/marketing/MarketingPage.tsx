import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

export function MarketingPage() {
  const { slug } = useParams()
  const { t } = useI18n()
  const [drafts, setDrafts] = useState<any[]>([])
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [gate, setGate] = useState(false)
  const [brevoGate, setBrevoGate] = useState(false)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [caps, setCaps] = useState<any[]>([])
  const [msg, setMsg] = useState('')

  async function refresh() {
    const [d, g, b, c, cap] = await Promise.all([
      api<{ drafts: any[] }>(`/api/b/${slug}/marketing/drafts`),
      api<{ ready: boolean }>(`/api/b/${slug}/integrations/metricool/ready`),
      api<{ ready: boolean }>(`/api/b/${slug}/integrations/brevo/ready`),
      api<{ campaigns: any[] }>(`/api/b/${slug}/marketing/brevo`),
      api<{ networks: any[] }>(`/api/b/${slug}/marketing/capabilities`),
    ])
    setDrafts(d.drafts)
    setGate(g.ready)
    setBrevoGate(b.ready)
    setCampaigns(c.campaigns)
    setCaps(cap.networks)
  }

  useEffect(() => { refresh().catch(console.error) }, [slug])

  async function createDraft() {
    await api(`/api/b/${slug}/marketing/drafts`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        masterText: text,
        variants: caps.filter((c) => c.canSchedule).slice(0, 5).map((c) => ({
          network: c.network,
          text,
          enabled: true,
          mediaKind: c.supportsVideo && !c.supportsImage ? 'video' : 'text',
        })),
      }),
    })
    setTitle('')
    setText('')
    await refresh()
  }

  async function schedule(id: string) {
    if (!confirm(t('confirmSchedule'))) return
    try {
      const r = await api(`/api/b/${slug}/marketing/drafts/${id}/schedule`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      })
      setMsg(JSON.stringify(r, null, 2))
      await refresh()
    } catch (e) { setMsg(String(e)) }
  }

  async function retry(id: string) {
    if (!confirm(t('confirmSchedule'))) return
    const r = await api(`/api/b/${slug}/marketing/drafts/${id}/retry`, {
      method: 'POST',
      body: JSON.stringify({ confirm: true }),
    })
    setMsg(JSON.stringify(r, null, 2))
    await refresh()
  }

  async function createBrevo() {
    await api(`/api/b/${slug}/marketing/brevo`, {
      method: 'POST',
      body: JSON.stringify({ name: title || 'Campaign', subject: title || 'Hello', htmlContent: `<p>${text || '…'}</p>` }),
    })
    await refresh()
  }

  async function sendBrevo(id: string) {
    if (!confirm(t('confirmSend'))) return
    try {
      const r = await api(`/api/b/${slug}/marketing/brevo/${id}/send`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      })
      setMsg(JSON.stringify(r, null, 2))
      await refresh()
    } catch (e) { setMsg(String(e)) }
  }

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>{t('marketing')}</h1>
      <p className="muted">Master draft + {t('variants')} · Metricool scheduler SoR</p>
      <div className="row">
        <span className={`badge ${gate ? 'ok' : 'warn'}`}>Metricool {gate ? 'ready' : t('keyRequired')}</span>
        <span className={`badge ${brevoGate ? 'ok' : 'warn'}`}>Brevo {brevoGate ? 'ready' : t('keyRequired')}</span>
      </div>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>{t('capabilities')}</h3>
        <table className="table">
          <thead><tr><th>Network</th><th>Image</th><th>Video</th><th>Max text</th></tr></thead>
          <tbody>
            {caps.map((c) => (
              <tr key={c.network}>
                <td>{c.network}</td>
                <td>{c.supportsImage ? '✓' : '—'}</td>
                <td>{c.supportsVideo ? '✓' : '—'}</td>
                <td className="kpi">{c.maxTextLength}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel stack">
        <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="textarea" placeholder="Master text" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="row">
          <button className="btn primary" onClick={createDraft}>{t('save')} draft</button>
          <button className="btn" onClick={createBrevo}>Brevo draft</button>
        </div>
      </div>
      <div className="panel">
        <table className="table">
          <thead><tr><th>Title</th><th>Remote</th><th></th></tr></thead>
          <tbody>
            {drafts.map((d) => (
              <tr key={d.id}>
                <td>{d.title}</td>
                <td className="kpi" style={{ maxWidth: 280, overflow: 'hidden' }}>{JSON.stringify(d.remoteStatus ?? {})}</td>
                <td className="row">
                  <button className="btn" disabled={!gate} onClick={() => schedule(d.id)}>{t('schedule')}</button>
                  <button className="btn" disabled={!gate} onClick={() => retry(d.id)}>{t('retry')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel">
        <h3>Brevo</h3>
        <table className="table">
          <thead><tr><th>Name</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.status}</td>
                <td><button className="btn danger" disabled={!brevoGate} onClick={() => sendBrevo(c.id)}>{t('send')}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg && <pre className="panel muted">{msg}</pre>}
    </div>
  )
}
