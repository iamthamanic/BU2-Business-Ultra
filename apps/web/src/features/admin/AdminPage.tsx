/**
 * AdminPage — superadmin / breakglass console inside AppShell.
 * Location: apps/web/src/features/admin/AdminPage.tsx
 */
import { useEffect, useMemo, useState } from 'react'
import { Buildings } from '@phosphor-icons/react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { AuthUser } from '../../app/App'
import { AppShell } from '../../components/AppShell'
import type { RailItem } from '../../components/IconRail'

export function AdminPage({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const { t } = useI18n()
  const [data, setData] = useState<any>(null)
  const [bizId, setBizId] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api('/api/admin/overview').then(setData).catch((e) => setMsg(String(e)))
  }, [])

  const railItems: RailItem[] = useMemo(
    () => [{ key: 'home', to: '/', end: true, label: t('businesses'), icon: Buildings }],
    [t],
  )

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
    <AppShell
      user={user}
      railItems={railItems}
      subtitle={<span>{t('admin')}</span>}
      showAdmin
      onLogout={onLogout}
    >
      <div className="stack" style={{ maxWidth: 1100 }}>
        <div>
          <h1 className="page-title">{t('admin')}</h1>
          <p className="muted page-lede">
            {user.email} · breakglass={String(user.isBreakglassOperator)}
          </p>
        </div>
        {data && (
          <div className="grid-2">
            <div className="panel">
              <h3 className="section-title">Users ({data.counts.users})</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u: any) => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td className="kpi">
                        {u.isSuperadmin ? 'sa ' : ''}
                        {u.isBreakglassOperator ? 'bg' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel">
              <h3 className="section-title">
                {t('businesses')} ({data.counts.businesses})
              </h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Slug</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.businesses.map((b: any) => (
                    <tr key={b.id}>
                      <td>{b.name}</td>
                      <td className="kpi">{b.slug}</td>
                      <td>
                        <span className={`badge ${b.status === 'active' ? 'ok' : 'warn'}`}>{b.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="panel stack">
          <h3 className="section-title">Breakglass restore owner</h3>
          <input className="input" placeholder="businessId" value={bizId} onChange={(e) => setBizId(e.target.value)} />
          <input className="input" placeholder="newOwnerUserId" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} />
          <textarea className="textarea" placeholder="reason (min 10)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn danger" type="button" onClick={restore}>
            Restore owner
          </button>
          {msg && <p className="muted">{msg}</p>}
        </div>
        {data?.recentAudit && (
          <div className="panel">
            <h3 className="section-title">Audit (latest)</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
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
    </AppShell>
  )
}
