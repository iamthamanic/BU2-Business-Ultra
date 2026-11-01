/**
 * HomePage — logged-in businesses console with collapsible sidebar shell.
 * Location: apps/web/src/features/business/HomePage.tsx
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Buildings,
  ArrowRight,
  Plus,
  CircleNotch,
  WarningCircle,
} from '@phosphor-icons/react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { AuthUser } from '../../app/App'
import { AppShell } from '../../components/AppShell'
import type { RailItem } from '../../components/IconRail'

type Biz = { id: string; name: string; slug: string; status: string; role: string }
type LoadState = 'loading' | 'ready' | 'error'

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export function HomePage({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const { t } = useI18n()
  const [list, setList] = useState<Biz[]>([])
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [err, setErr] = useState('')
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [creating, setCreating] = useState(false)

  async function refresh() {
    setLoadState('loading')
    setErr('')
    try {
      const r = await api<{ businesses: Biz[] }>('/api/businesses')
      setList(r.businesses)
      setLoadState('ready')
    } catch (e) {
      setErr(String(e))
      setLoadState('error')
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const railItems: RailItem[] = useMemo(
    () => [{ key: 'home', to: '/', end: true, label: t('businesses'), icon: Buildings }],
    [t],
  )

  async function create(e?: FormEvent) {
    e?.preventDefault()
    if (!name.trim() || !slug.trim()) return
    setCreating(true)
    setErr('')
    try {
      await api('/api/businesses', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
      })
      setName('')
      setSlug('')
      setSlugTouched(false)
      await refresh()
    } catch (e) {
      setErr(String(e))
    } finally {
      setCreating(false)
    }
  }

  function onNameChange(value: string) {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  return (
    <AppShell
      user={user}
      railItems={railItems}
      subtitle={<span>{t('businesses')}</span>}
      onLogout={onLogout}
    >
      <div className="home-layout">
        <section className="panel home-list-panel" aria-labelledby="biz-heading">
          <div className="home-panel-head">
            <div>
              <h1 id="biz-heading" className="page-title">
                {t('businesses')}
              </h1>
              <p className="muted page-lede">{t('businessesLede')}</p>
            </div>
            {loadState === 'ready' && <span className="badge">{list.length}</span>}
          </div>

          {loadState === 'loading' && (
            <div className="state-block muted" role="status">
              <CircleNotch className="spin" size={20} weight="regular" aria-hidden />
              {t('loading')}
            </div>
          )}

          {loadState === 'error' && (
            <div className="state-block state-error" role="alert">
              <WarningCircle size={20} weight="regular" aria-hidden />
              <div className="stack" style={{ gap: 8 }}>
                <span>{err || t('loadError')}</span>
                <button type="button" className="btn" onClick={refresh}>
                  {t('retry')}
                </button>
              </div>
            </div>
          )}

          {loadState === 'ready' && list.length === 0 && (
            <div className="state-block empty-state">
              <Buildings size={28} weight="regular" aria-hidden />
              <p className="muted">{t('emptyStart')}</p>
            </div>
          )}

          {loadState === 'ready' && list.length > 0 && (
            <ul className="biz-list" role="list">
              {list.map((b) => (
                <li key={b.id} className="biz-row">
                  <div className="biz-row-main">
                    <span className="biz-name">{b.name}</span>
                    <span className="kpi biz-slug">{b.slug}</span>
                  </div>
                  <div className="biz-row-meta">
                    <span className={`badge ${b.status === 'active' ? 'ok' : 'warn'}`}>{b.status}</span>
                    <span className="badge">{b.role}</span>
                    <Link className="btn primary biz-open" to={`/b/${b.slug}`}>
                      {t('open')}
                      <ArrowRight size={14} weight="bold" aria-hidden />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel home-create-panel" aria-labelledby="create-heading">
          <h2 id="create-heading" className="section-title">
            {t('createBusiness')}
          </h2>
          <p className="muted page-lede">{t('createBusinessLede')}</p>
          <form className="stack" onSubmit={create}>
            <label>
              <span className="label">{t('name')}</span>
              <input
                className="input"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                autoComplete="organization"
                required
              />
            </label>
            <label>
              <span className="label">{t('slug')}</span>
              <input
                className="input kpi"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setSlug(slugify(e.target.value))
                }}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
              />
            </label>
            <button
              className="btn primary"
              type="submit"
              disabled={creating || !name.trim() || !slug.trim()}
            >
              {creating ? (
                <CircleNotch className="spin" size={16} weight="regular" aria-hidden />
              ) : (
                <Plus size={16} weight="bold" aria-hidden />
              )}
              {t('createBusiness')}
            </button>
            {err && loadState !== 'error' && (
              <p className="badge bad" role="alert">
                {err}
              </p>
            )}
          </form>
        </section>
      </div>
    </AppShell>
  )
}
