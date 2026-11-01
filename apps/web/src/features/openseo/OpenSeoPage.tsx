/**
 * OpenSeoPage — SEO or GEO surface under Marketing nav; URLs remain /tools/seo and /tools/geo.
 * Location: apps/web/src/features/openseo/OpenSeoPage.tsx
 */
import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

export function OpenSeoPage() {
  const { slug } = useParams()
  const { pathname } = useLocation()
  const { t } = useI18n()
  const isGeo = pathname.includes('/tools/geo')
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

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>
        {t('marketing')} · {title}
      </h1>
      <p className="muted">
        {isGeo ? t('geoLede') : t('seoLede')}
      </p>
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
