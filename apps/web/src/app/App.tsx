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
import { CatalogPage } from '../features/catalog/CatalogPage'
import { ProductShell } from '../features/product/ProductShell'
import { CustomerPage } from '../features/customer/CustomerPage'
import { ProjectsPage } from '../features/projects/ProjectsPage'
import { MarketingShell } from '../features/marketing/MarketingShell'
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
    try {
      await api('/api/auth/logout', { method: 'POST' })
    } catch {
      // Always clear client session even if revoke/cookie clear fails
    }
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
        {/* Default company landing = Marketing */}
        <Route index element={<CoRedirect to="marketing" />} />
        {/* Katalog lives under Product; keep old bookmarks alive */}
        <Route path="catalog" element={<CoRedirect to="product/katalog" />} />
        <Route path="katalog" element={<CoRedirect to="product/katalog" />} />
        <Route path="product" element={<ProductShell />}>
          <Route index element={<Navigate to="katalog" replace />} />
          <Route path="katalog" element={<CatalogPage />} />
          <Route path="catalog" element={<CoRedirect to="product/katalog" />} />
          <Route path="costmybusiness/*" element={<CmbPage />} />
          <Route path="costmybusiness" element={<CmbPage />} />
          <Route path="cmb" element={<CoRedirect to="product/costmybusiness" />} />
        </Route>
        <Route path="customer" element={<CustomerPage />} />
        <Route path="projects" element={<ProjectsPage />} />

        <Route path="marketing" element={<MarketingShell />}>
          <Route
            index
            element={<Navigate to={`funnel/organic/${DEFAULT_ORGANIC_CHANNEL}`} replace />}
          />
          <Route path="personas" element={<PersonasPage />} />
          <Route path="funnel/organic/website" element={<OpenSeoPage />} />
          <Route path="funnel/organic/:channel" element={<MarketingPage />} />
          <Route
            path="funnel/organic"
            element={<Navigate to={DEFAULT_ORGANIC_CHANNEL} replace />}
          />
          <Route path="funnel/custom/:channel" element={<MarketingPage />} />
          <Route path="funnel/custom" element={<Navigate to="email" replace />} />
          <Route path="funnel/paid/:channel" element={<AdsPage />} />
          <Route path="funnel/paid" element={<Navigate to={DEFAULT_PAID_CHANNEL} replace />} />
        </Route>

        <Route path="tools/cmb/*" element={<CoRedirect to="product/costmybusiness" />} />
        <Route path="tools/cmb" element={<CoRedirect to="product/costmybusiness" />} />
        <Route path="tools/sortanize/*" element={<SortanizePage />} />
        <Route path="tools/sortanize" element={<SortanizePage />} />
        <Route path="tools/checkmap/m/:mapId" element={<CheckMapPage />} />
        <Route path="tools/checkmap/*" element={<CheckMapPage />} />
        <Route path="tools/checkmap" element={<CheckMapPage />} />
        <Route path="tools/persona-journey/*" element={<CoRedirect to="marketing/personas" />} />
        <Route path="tools/persona-journey" element={<CoRedirect to="marketing/personas" />} />
        <Route path="tools/personas/*" element={<CoRedirect to="marketing/personas" />} />
        <Route path="tools/personas" element={<CoRedirect to="marketing/personas" />} />
        <Route path="tools/seo/*" element={<CoRedirect to="marketing/funnel/organic/website" />} />
        <Route path="tools/seo" element={<CoRedirect to="marketing/funnel/organic/website" />} />
        <Route
          path="tools/geo/*"
          element={<CoRedirect to="marketing/funnel/organic/website?surface=geo" />}
        />
        <Route
          path="tools/geo"
          element={<CoRedirect to="marketing/funnel/organic/website?surface=geo" />}
        />

        <Route path="settings" element={<SettingsPage />} />

        {/* Short / legacy aliases under company */}
        <Route path="comments" element={<CoRedirect to="marketing" />} />
        <Route path="ads" element={<CoRedirect to={`marketing/funnel/paid/${DEFAULT_PAID_CHANNEL}`} />} />
        <Route path="c/:channel" element={<CoRedirectOrganic />} />
        <Route path="cmb" element={<CoRedirect to="product/costmybusiness" />} />
        <Route path="costmybusiness" element={<CoRedirect to="product/costmybusiness" />} />
        <Route path="checkmap" element={<CoRedirect to="tools/checkmap" />} />
        <Route path="personas" element={<CoRedirect to="marketing/personas" />} />
        <Route path="sortanize" element={<CoRedirect to="tools/sortanize" />} />
        <Route path="openseo" element={<CoRedirect to="marketing/funnel/organic/website" />} />
        <Route path="overview" element={<CoRedirect to="marketing" />} />
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
