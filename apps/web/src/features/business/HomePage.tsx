/**
 * HomePage — authenticated `/` gate: redirect to last (or first) company, else create-first.
 * No Companies list nav; empty memberships open the create modal.
 * Location: apps/web/src/features/business/HomePage.tsx
 */
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { companyBase } from '../../lib/companyPaths'
import { pickLandingSlug, writeLastCompany } from '../../lib/lastCompany'
import { Buildings, CircleNotch, Plus, WarningCircle } from '@phosphor-icons/react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { AuthUser } from '../../app/App'
import { AppShell } from '../../components/AppShell'
import { CreateCompanyModal } from '../../components/CreateCompanyModal'

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
  const navigate = useNavigate()
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
    void refresh()
  }, [])

  const landing = loadState === 'ready' ? pickLandingSlug(list) : null

  useEffect(() => {
    if (loadState !== 'ready') return
    if (landing) return
    setModalOpen(true)
  }, [loadState, landing])

  useEffect(() => {
    if (landing) writeLastCompany(landing)
  }, [landing])

  if (landing) {
    return <Navigate to={companyBase(landing)} replace />
  }

  return (
    <AppShell user={user} railItems={[]} subtitle={<span>{t('businesses')}</span>} onLogout={onLogout}>
      <div className="home-layout">
        <section className="panel home-list-panel" aria-labelledby="biz-heading">
          <div className="home-panel-head">
            <div>
              <h1 id="biz-heading" className="page-title">
                {t('createBusiness')}
              </h1>
              <p className="muted page-lede">{t('emptyStart')}</p>
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
                <button type="button" className="btn" onClick={() => void refresh()}>
                  {t('retry')}
                </button>
              </div>
            </div>
          )}

          {loadState === 'ready' && (
            <div className="state-block empty-state">
              <Buildings size={28} weight="regular" aria-hidden />
              <p className="muted">{t('emptyStart')}</p>
              <button type="button" className="btn primary" onClick={() => setModalOpen(true)}>
                <Plus size={16} weight="bold" aria-hidden />
                {t('createCompanyBtn')}
              </button>
            </div>
          )}
        </section>
      </div>

      <CreateCompanyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(biz) => {
          writeLastCompany(biz.slug)
          navigate(companyBase(biz.slug), { replace: true })
        }}
      />
    </AppShell>
  )
}
