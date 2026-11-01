import { useEffect, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { AuthUser } from '../../app/App'

export function OverviewPage() {
  const { slug } = useParams()
  const { user } = useOutletContext<{ user: AuthUser }>()
  const { t } = useI18n()
  const [biz, setBiz] = useState<any>(null)
  const [gates, setGates] = useState<Record<string, boolean>>({})
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!slug) return
    api(`/api/b/${slug}`).then((r: any) => setBiz(r.business))
    api<{ gates: Record<string, boolean> }>(`/api/b/${slug}/settings/feature-gates`).then((r) => setGates(r.gates))
  }, [slug])

  async function archive() {
    if (!confirm(t('archiveConfirm'))) return
    try {
      await api(`/api/b/${slug}/archive`, { method: 'POST', body: '{}' })
      setMsg('archived')
    } catch (e) {
      setMsg(String(e))
    }
  }

  async function reactivate() {
    await api(`/api/b/${slug}/reactivate`, { method: 'POST', body: '{}' })
    setMsg('reactivated')
  }

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>{t('overview')}</h1>
      <div className="grid-2">
        <div className="panel stack">
          <div className="muted">{t('company')}</div>
          <strong>{biz?.name}</strong>
          <span className="kpi">{biz?.slug}</span>
          <span className={`badge ${biz?.status === 'active' ? 'ok' : 'warn'}`}>{biz?.status}</span>
          <div className="row">
            <button className="btn danger" onClick={archive}>{t('archive')}</button>
            <button className="btn" onClick={reactivate}>{t('reactivate')}</button>
          </div>
          {msg && <p className="muted">{msg}</p>}
        </div>
        <div className="panel stack">
          <div className="muted">Integration gates</div>
          {Object.entries(gates).map(([k, v]) => (
            <div key={k} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{k}</span>
              <span className={`badge ${v ? 'ok' : 'warn'}`}>{v ? 'ready' : 'key missing'}</span>
            </div>
          ))}
          <p className="muted">{user.email}</p>
        </div>
      </div>
    </div>
  )
}
