import { useEffect, useState } from 'react'
import { NavLink, Outlet, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useI18n } from '../lib/i18n'
import type { AuthUser } from '../app/App'

const icons: Record<string, string> = {
  overview: '◉',
  catalog: '▤',
  marketing: '✎',
  ads: '◈',
  cmb: '∑',
  checkmap: '⧉',
  personas: '☺',
  sortanize: '⇅',
  openseo: '◎',
  settings: '⚙',
}

export function BusinessShell({ user }: { user: AuthUser }) {
  const { slug } = useParams()
  const { t, locale, setLocale } = useI18n()
  const [railOpen, setRailOpen] = useState(false)
  const [biz, setBiz] = useState<{ name: string; status: string; logoPath?: string | null } | null>(null)

  useEffect(() => {
    if (!slug) return
    api<{ business: { name: string; status: string; logoPath?: string | null } }>(`/api/b/${slug}`)
      .then((r) => setBiz(r.business))
      .catch(() => setBiz(null))
  }, [slug])

  const base = `/b/${slug}`
  const links = [
    ['', 'overview'],
    ['catalog', 'catalog'],
    ['marketing', 'marketing'],
    ['ads', 'ads'],
    ['cmb', 'cmb'],
    ['checkmap', 'checkmap'],
    ['personas', 'personas'],
    ['sortanize', 'sortanize'],
    ['openseo', 'openseo'],
    ['settings', 'settings'],
  ] as const

  return (
    <div className="shell">
      <div className={`rail-backdrop ${railOpen ? 'open' : ''}`} onClick={() => setRailOpen(false)} />
      <aside className={`rail ${railOpen ? 'open' : ''}`} aria-label="Navigation">
        {links.map(([path, key]) => (
          <NavLink
            key={key}
            to={path ? `${base}/${path}` : base}
            end={!path}
            title={t(key)}
            onClick={() => setRailOpen(false)}
          >
            <span aria-hidden>{icons[key]}</span>
          </NavLink>
        ))}
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="row">
            <button type="button" className="btn rail-toggle" onClick={() => setRailOpen(true)} aria-label="Menu">
              ☰
            </button>
            <div>
              <div className="brand">{t('brand')}</div>
              <div className="muted">{biz?.name ?? slug}{biz?.status === 'archived' ? ' · archived' : ''}</div>
            </div>
          </div>
          <div className="row">
            <select className="select" style={{ width: 'auto' }} value={locale} onChange={(e) => setLocale(e.target.value as 'de' | 'en')}>
              <option value="de">DE</option>
              <option value="en">EN</option>
            </select>
            <span className="muted">{user.email}</span>
          </div>
        </header>
        <div className="content">
          <Outlet context={{ slug: slug!, user }} />
        </div>
      </div>
    </div>
  )
}
