import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { AuthUser } from '../../app/App'

export function AdminPage({ user }: { user: AuthUser }) {
  const { t } = useI18n()
  const [data, setData] = useState<any>(null)
  const [bizId, setBizId] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api('/api/admin/overview').then(setData).catch((e) => setMsg(String(e)))
  }, [])

  async function restore() {
    try {
      await api('/api/admin/breakglass/restore-owner', {
        method: 'POST',
        body: JSON.stringify({
          businessId: bizId,
          newOwnerUserId: ownerId,
          reason,
          identityVerified: true,
        }),
      })
      setMsg('owner restored')
    } catch (e) {
      setMsg(String(e))
    }
  }

  return (
    <div className="content" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="brand" style={{ margin: 0 }}>{t('admin')}</h1>
        <Link className="btn" to="/">← Home</Link>
      </div>
      <p className="muted">{user.email} · breakglass={String(user.isBreakglassOperator)}</p>
      {data && (
        <div className="grid-2">
          <div className="panel">
            <h3>Users ({data.counts.users})</h3>
            <table className="table">
              <thead><tr><th>Email</th><th>Flags</th></tr></thead>
              <tbody>
                {data.users.map((u: any) => (
                  <tr key={u.id}>
                    <td>{u.email}</td>
                    <td className="kpi">{u.isSuperadmin ? 'sa ' : ''}{u.isBreakglassOperator ? 'bg' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel">
            <h3>Businesses ({data.counts.businesses})</h3>
            <table className="table">
              <thead><tr><th>Name</th><th>Slug</th><th>Status</th></tr></thead>
              <tbody>
                {data.businesses.map((b: any) => (
                  <tr key={b.id}>
                    <td>{b.name}</td>
                    <td>{b.slug}</td>
                    <td>{b.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="panel stack">
        <h3>Breakglass restore owner</h3>
        <input className="input" placeholder="businessId" value={bizId} onChange={(e) => setBizId(e.target.value)} />
        <input className="input" placeholder="newOwnerUserId" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} />
        <textarea className="textarea" placeholder="reason (min 10)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button className="btn danger" onClick={restore}>Restore owner</button>
        {msg && <p className="muted">{msg}</p>}
      </div>
      {data?.recentAudit && (
        <div className="panel">
          <h3>Audit (latest)</h3>
          <table className="table">
            <thead><tr><th>Action</th><th>Status</th><th>When</th></tr></thead>
            <tbody>
              {data.recentAudit.slice(0, 20).map((a: any) => (
                <tr key={a.id}>
                  <td>{a.action}</td>
                  <td>{a.status}</td>
                  <td className="kpi">{a.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
