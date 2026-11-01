/**
 * App — auth gate + React Router map aligned to legacy `/co/:slug/...` shell paths.
 * Location: apps/web/src/app/App.tsx
 */
import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import {
  companyBase,
  mapOldBu2FrontendPath,
  DEFAULT_ORGANIC_CHANNEL,
  DEFAULT_PAID_CHANNEL,
} from '../lib/companyPaths'
import { LoginPage } from '../features/auth/LoginPage'
import { VerifyPage } from '../features/auth/VerifyPage'
import { HomePage } from '../features/business/HomePage'
import { BusinessShell } from '../components/BusinessShell'
import { OverviewPage } from '../features/business/OverviewPage'
import { CatalogPage } from '../features/catalog/CatalogPage'
import { MarketingPage } from '../features/marketing/MarketingPage'
import { AdsPage } from '../features/ads/AdsPage'
import { CmbPage } from '../features/cmb/CmbPage'
import { CheckMapPage } from '../features/checkmap/CheckMapPage'
import { PersonasPage } from '../features/personas/PersonasPage'
import { SortanizePage } from '../features/sortanize/SortanizePage'
import { OpenSeoPage } from '../features/openseo/OpenSeoPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { AdminPage } from '../features/admin/AdminPage'

export type AuthUser = {
  id: string
  email: string
  displayName: string | null
  isSuperadmin: boolean
  isBreakglassOperator: boolean
  locale: string
}

/** Redirect helper: `/co/:slug/<to>` */
function CoRedirect({ to }: { to: string }) {
  const { slug } = useParams()
  if (!slug) return <Navigate to="/" replace />
  const path = to.startsWith('/') ? `${companyBase(slug)}${to}` : `${companyBase(slug)}/${to}`
  return <Navigate to={path} replace />
}

/** Bookmarks: `/b/:slug/*` → canonical `/co/:slug/...` */
function LegacyBu2Redirect() {
  const { slug, '*': rest } = useParams()
  if (!slug) return <Navigate to="/" replace />
  return <Navigate to={mapOldBu2FrontendPath(slug, rest || '')} replace />
}

export function App() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined)
  const navigate = useNavigate()

  useEffect(() => {
    api<{ user: AuthUser }>('/api/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
  }, [])

  if (user === undefined) {
    return <div className="login-page muted">…</div>
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' })
    setUser(null)
    navigate('/login', { replace: true })
  }

  const authedShell = user ? (
    <BusinessShell user={user} onLogout={logout} />
  ) : (
    <Navigate to="/login" replace />
  )

  return (
    <Routes>
      <Route path="/login" element={<LoginPage onAuthed={(u) => { setUser(u); navigate('/') }} />} />
      <Route path="/login/verify" element={<VerifyPage onAuthed={(u) => { setUser(u); navigate('/') }} />} />
      <Route
        path="/"
        element={user ? <HomePage user={user} onLogout={logout} /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/admin"
        element={
          user?.isSuperadmin || user?.isBreakglassOperator ? (
            <AdminPage user={user} onLogout={logout} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route path="/admin/companies" element={<Navigate to="/admin" replace />} />

      {/* Legacy BU2 prefix — keep bookmarks alive */}
      <Route path="/b/:slug/*" element={<LegacyBu2Redirect />} />

      <Route path="/co/:slug" element={authedShell}>
        <Route index element={<OverviewPage />} />
        <Route path="catalog" element={<CatalogPage />} />

        <Route path="marketing/funnel/organic/:channel" element={<MarketingPage />} />
        <Route
          path="marketing/funnel/organic"
          element={<CoRedirect to={`marketing/funnel/organic/${DEFAULT_ORGANIC_CHANNEL}`} />}
        />
        <Route path="marketing/funnel/custom/:channel" element={<MarketingPage />} />
        <Route path="marketing/funnel/custom" element={<CoRedirect to="marketing/funnel/custom/email" />} />
        <Route path="marketing/funnel/paid/:channel" element={<AdsPage />} />
        <Route
          path="marketing/funnel/paid"
          element={<CoRedirect to={`marketing/funnel/paid/${DEFAULT_PAID_CHANNEL}`} />}
        />
        <Route
          path="marketing"
          element={<CoRedirect to={`marketing/funnel/organic/${DEFAULT_ORGANIC_CHANNEL}`} />}
        />

        <Route path="tools/cmb/*" element={<CmbPage />} />
        <Route path="tools/cmb" element={<CmbPage />} />
        <Route path="tools/sortanize/*" element={<SortanizePage />} />
        <Route path="tools/sortanize" element={<SortanizePage />} />
        <Route path="tools/checkmap/m/:mapId" element={<CheckMapPage />} />
        <Route path="tools/checkmap/*" element={<CheckMapPage />} />
        <Route path="tools/checkmap" element={<CheckMapPage />} />
        <Route path="tools/persona-journey/*" element={<PersonasPage />} />
        <Route path="tools/persona-journey" element={<PersonasPage />} />
        <Route path="tools/personas/*" element={<CoRedirect to="tools/persona-journey" />} />
        <Route path="tools/personas" element={<CoRedirect to="tools/persona-journey" />} />
        <Route path="tools/seo/*" element={<OpenSeoPage />} />
        <Route path="tools/seo" element={<OpenSeoPage />} />
        <Route path="tools/geo/*" element={<CoRedirect to="tools/seo" />} />
        <Route path="tools/geo" element={<CoRedirect to="tools/seo" />} />

        <Route path="settings" element={<SettingsPage />} />

        {/* Short / legacy aliases under company */}
        <Route path="comments" element={<CoRedirect to="" />} />
        <Route path="ads" element={<CoRedirect to={`marketing/funnel/paid/${DEFAULT_PAID_CHANNEL}`} />} />
        <Route path="c/:channel" element={<CoRedirectOrganic />} />
        <Route path="cmb" element={<CoRedirect to="tools/cmb" />} />
        <Route path="checkmap" element={<CoRedirect to="tools/checkmap" />} />
        <Route path="personas" element={<CoRedirect to="tools/persona-journey" />} />
        <Route path="sortanize" element={<CoRedirect to="tools/sortanize" />} />
        <Route path="openseo" element={<CoRedirect to="tools/seo" />} />
      </Route>

      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  )
}

/** `/co/:slug/c/:channel` → organic funnel (legacy short URL). */
function CoRedirectOrganic() {
  const { slug, channel } = useParams()
  if (!slug) return <Navigate to="/" replace />
  const ch = (channel || DEFAULT_ORGANIC_CHANNEL).toLowerCase()
  return <Navigate to={`${companyBase(slug)}/marketing/funnel/organic/${ch}`} replace />
}
