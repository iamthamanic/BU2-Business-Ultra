import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { AuthUser } from '../../app/App'

type Biz = { id: string; name: string; slug: string; status: string; role: string }

export function HomePage({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const { t, locale, setLocale } = useI18n()
  const [list, setList] = useState<Biz[]>([])
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [err, setErr] = useState('')

  async function refresh() {
    const r = await api<{ businesses: Biz[] }>('/api/businesses')
    setList(r.businesses)
  }

  useEffect(() => {
    refresh().catch((e) => setErr(String(e)))
  }, [])

  async function create() {
    setErr('')
    try {
      await api('/api/businesses', {
        method: 'POST',
        body: JSON.stringify({ name, slug }),
      })
      setName('')
      setSlug('')
      await refresh()
    } catch (e) {
      setErr(String(e))
    }
  }

  return (
    <div className="content" style={{ maxWidth: 920, margin: '0 auto' }}>
      <div className="topbar" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
        <div className="brand">{t('brand')}</div>
        <div className="row">
          <select className="select" style={{ width: 'auto' }} value={locale} onChange={(e) => setLocale(e.target.value as 'de' | 'en')}>
            <option value="de">DE</option>
            <option value="en">EN</option>
          </select>
          {(user.isSuperadmin || user.isBreakglassOperator) && <Link className="btn" to="/admin">{t('admin')}</Link>}
          <button className="btn" onClick={onLogout}>{t('logout')}</button>
        </div>
      </div>

      <div className="panel stack">
        <h2 style={{ margin: 0 }}>{t('businesses')}</h2>
        {list.length === 0 && <p className="muted">{t('emptyStart')}</p>}
        <table className="table">
          <thead>
            <tr><th>{t('name')}</th><th>{t('slug')}</th><th>Role</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td className="kpi">{b.slug}</td>
                <td>{b.role}</td>
                <td><Link to={`/b/${b.slug}`}>Open →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel stack">
        <h3 style={{ margin: 0 }}>{t('createBusiness')}</h3>
        <div className="grid-2">
          <label><span className="label">{t('name')}</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label><span className="label">{t('slug')}</span><input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} /></label>
        </div>
        <button className="btn primary" onClick={create}>{t('createBusiness')}</button>
        {err && <p className="badge bad">{err}</p>}
      </div>
    </div>
  )
}
