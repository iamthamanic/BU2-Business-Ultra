/**
 * HomePage — logged-in companies console with collapsible sidebar shell.
 * Create flow is a modal (+ Company); list rows show logo thumbnails.
 * Location: apps/web/src/features/business/HomePage.tsx
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { companyBase } from '../../lib/companyPaths'
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
import { BizLogo } from '../../components/BizLogo'
import { CreateCompanyModal } from '../../components/CreateCompanyModal'
import type { RailItem } from '../../components/IconRail'

type Biz = {
  id: string
  name: string
  slug: string
  status: string
  role: string
  logoPath?: string | null
}
type LoadState = 'loading' | 'ready' | 'error'

export function HomePage({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const { t } = useI18n()
  const [list, setList] = useState<Biz[]>([])
  const [err, setErr] = useState('')
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [modalOpen, setModalOpen] = useState(false)

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
            <div className="home-panel-actions">
              {loadState === 'ready' && <span className="badge">{list.length}</span>}
              <button
                type="button"
                className="btn primary"
                onClick={() => setModalOpen(true)}
              >
                <Plus size={16} weight="bold" aria-hidden />
                {t('createCompanyBtn')}
              </button>
            </div>
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
              <button type="button" className="btn primary" onClick={() => setModalOpen(true)}>
                <Plus size={16} weight="bold" aria-hidden />
                {t('createCompanyBtn')}
              </button>
            </div>
          )}

          {loadState === 'ready' && list.length > 0 && (
            <ul className="biz-list" role="list">
              {list.map((b) => (
                <li key={b.id} className="biz-row">
                  <div className="biz-row-main">
                    <BizLogo name={b.name} logoPath={b.logoPath} className="biz-logo" />
                    <div className="biz-row-text">
                      <span className="biz-name">{b.name}</span>
                      <span className="kpi biz-slug">{b.slug}</span>
                    </div>
                  </div>
                  <div className="biz-row-meta">
                    <span className={`badge ${b.status === 'active' ? 'ok' : 'warn'}`}>{b.status}</span>
                    <span className="badge">{b.role}</span>
                    <Link className="btn primary biz-open" to={companyBase(b.slug)}>
                      {t('open')}
                      <ArrowRight size={14} weight="bold" aria-hidden />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <CreateCompanyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          void refresh()
        }}
      />
    </AppShell>
  )
}
