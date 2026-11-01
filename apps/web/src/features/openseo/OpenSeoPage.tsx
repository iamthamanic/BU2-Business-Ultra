/**
 * OpenSeoPage — Website / SEO / GEO surface under Marketing Organic → Website.
 * Also reachable via legacy `/tools/seo` redirects. Location: apps/web/src/features/openseo/OpenSeoPage.tsx
 */
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { MktTab, MktTabs } from '../../components/MktTabs'
import { MKT_SURFACE_ICONS } from '../../components/mktTabIcons'
import { api } from '../../lib/api'
import { companyRoutes } from '../../lib/companyPaths'
import { useI18n } from '../../lib/i18n'

export function OpenSeoPage() {
  const { slug } = useParams()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useI18n()

  const underWebsite = pathname.includes('/organic/website')
  const isGeo =
    pathname.includes('/tools/geo') ||
    searchParams.get('surface') === 'geo' ||
    (underWebsite && searchParams.get('surface') === 'geo')

  const title = isGeo ? t('geo') : t('seo')
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
        body: JSON.stringify({ surface: isGeo ? 'ai-visibility' : 'seo' }),
      })
      setHandoff(r)
      if (r.launchUrl) window.open(r.launchUrl, '_blank', 'noopener')
    } catch (e) {
      setErr(String(e))
    }
  }

  function setSurface(next: 'seo' | 'geo') {
    if (!slug) return
    const base = companyRoutes(slug).openseo
    navigate(next === 'geo' ? `${base}?surface=geo` : base, { replace: true })
  }

  return (
    <div className="stack funnel-page">
      {underWebsite ? (
        <div className="mkt-pane-toolbar">
          <MktTabs level="surface" label={t('navWebsite')}>
            <MktTab
              active={!isGeo}
              label={t('seo')}
              onClick={() => setSurface('seo')}
              icon={MKT_SURFACE_ICONS.seo}
            />
            <MktTab
              active={isGeo}
              label={t('geo')}
              onClick={() => setSurface('geo')}
              icon={MKT_SURFACE_ICONS.geo}
            />
          </MktTabs>
          <p className="muted page-lede" style={{ margin: 0 }}>
            {isGeo ? t('geoLede') : t('seoLede')}
          </p>
        </div>
      ) : (
        <header className="funnel-head">
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>
              {title}
            </h1>
            <p className="muted page-lede">{isGeo ? t('geoLede') : t('seoLede')}</p>
          </div>
        </header>
      )}

      {err && <p className="badge bad">{err}</p>}
      <div className="panel stack">
        <div>
          Status: <strong>{info?.instance?.status ?? '…'}</strong>
        </div>
        <div className="muted">{info?.instance?.baseUrl}</div>
        <div className="row">
          <button className="btn" onClick={provision} type="button">
            Provision stub
          </button>
          <button className="btn primary" onClick={launch} type="button">
            {t('launchOpenSeo')}
          </button>
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
