import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

export function OpenSeoPage() {
  const { slug } = useParams()
  const { t } = useI18n()
  const [info, setInfo] = useState<any>(null)
  const [handoff, setHandoff] = useState<any>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api(`/api/b/${slug}/openseo`).then(setInfo).catch((e) => setErr(String(e)))
  }, [slug])

  async function provision() {
    const r = await api<{ instance: unknown }>(`/api/b/${slug}/openseo/provision`, {
      method: 'POST',
      body: '{}',
    })
    setInfo((prev: any) => ({ ...prev, instance: r.instance }))
  }

  async function launch() {
    try {
      const r = await api<{ launchUrl?: string; note?: string }>(`/api/b/${slug}/openseo/handoff`, {
        method: 'POST',
        body: '{}',
      })
      setHandoff(r)
      if (r.launchUrl) window.open(r.launchUrl, '_blank', 'noopener')
    } catch (e) {
      setErr(String(e))
    }
  }

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>{t('openseo')}</h1>
      <p className="muted">External original app · SSO handoff stub · per-business identity</p>
      {err && <p className="badge bad">{err}</p>}
      <div className="panel stack">
        <div>Status: <strong>{info?.instance?.status ?? '…'}</strong></div>
        <div className="muted">{info?.instance?.baseUrl}</div>
        <pre className="muted">{JSON.stringify(info?.access ?? {}, null, 2)}</pre>
        <div className="row">
          <button className="btn" onClick={provision}>Provision stub</button>
          <button className="btn primary" onClick={launch}>{t('launchOpenSeo')}</button>
        </div>
      </div>
      {handoff && (
        <div className="panel stack">
          <span className="badge warn">SSO stub</span>
          <code>{handoff.launchUrl}</code>
          <p className="muted">{handoff.note}</p>
        </div>
      )}
    </div>
  )
}
