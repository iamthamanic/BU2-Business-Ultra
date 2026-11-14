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
import { SetupPage } from '../features/auth/SetupPage'
import { HomePage } from '../features/business/HomePage'
import { BusinessShell } from '../components/BusinessShell'
import { ProductShell } from '../features/products/ProductShell'
import { CustomerShell } from '../features/customers/CustomerShell'
import { CustomerDetail } from '../features/customers/CustomerDetail'
import { ProjectsShell } from '../features/projects/ProjectsShell'
import { ProjectDetail } from '../features/projects/ProjectDetail'
import { MyTasksPage } from '../features/projects/MyTasksPage'
import { RecurringRulesPage } from '../features/projects/RecurringRulesPage'
import { InboxPage } from '../features/inbox/InboxPage'
import { FinancePage } from '../features/finance/FinancePage'
import { MarketingShell } from '../features/marketing/MarketingShell'
import { MarketingPage } from '../features/marketing/MarketingPage'
import { AdsPage } from '../features/ads/AdsPage'
import { StyleguidePage } from '../features/marketing/StyleguidePage'
import { PersonasPage } from '../features/personas/PersonasPage'
import { SortanizePage } from '../features/sortanize/SortanizePage'
import { ToolsPage } from '../features/tools/ToolsPage'
import { OpenSeoPage } from '../features/openseo/OpenSeoPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { AdminPage } from '../features/admin/AdminPage'
import { LegalIndexPage, LegalPage } from '../features/legal/LegalPage'

export type AuthUser = {
  id: string
  email: string
  displayName: string | null
  isSuperadmin: boolean
  isBreakglassOperator: boolean
  locale: string
  /** Present on /api/auth/me; optional after login until me refresh. */
  platformCapabilities?: {
    'companies.create'?: boolean
  }
}

/** Redirect helper: `/co/:slug/<to>` */
function CoRedirect({ to }: { to: string }) {
  const { slug } = useParams()
  if (!slug) return <Navigate to="/" replace />
  const path = to.startsWith('/') ? `${companyBase(slug)}${to}` : `${companyBase(slug)}/${to}`
  return <Navigate to={path} replace />
}

/** Legacy `/co/:slug/contacts/:id` → `/customer/:id`. */
function ContactsIdRedirect() {
  const { slug, id } = useParams()
  if (!slug || !id) return <Navigate to="/" replace />
  return <Navigate to={`${companyBase(slug)}/customer/${encodeURIComponent(id)}`} replace />
}

/** Bookmarks: `/b/:slug/*` → canonical `/co/:slug/...` */
function LegacyBu2Redirect() {
  const { slug, '*': rest } = useParams()
  if (!slug) return <Navigate to="/" replace />
  return <Navigate to={mapOldBu2FrontendPath(slug, rest || '')} replace />
}

export function App() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined)
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api<{ required: boolean }>('/api/setup/status')
      .then((r) => setNeedsSetup(r.required))
      .catch(() => setNeedsSetup(false))
    api<{ user: AuthUser }>('/api/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
  }, [])

  if (user === undefined || needsSetup === null) {
    return <div className="login-page muted">…</div>
  }

  if (needsSetup && !user) {
    return (
      <SetupPage
        onDone={(u) => {
          setNeedsSetup(false)
          setUser(u)
          navigate('/', { replace: true })
        }}
      />
    )
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
      {/* Public legal pages — German URLs; /legal/* redirects for old drafts. */}
      <Route path="/rechtliches" element={<LegalIndexPage />} />
      <Route path="/rechtliches/:doc" element={<LegalPage />} />
      <Route path="/legal" element={<Navigate to="/rechtliches" replace />} />
      <Route path="/legal/:doc" element={<LegalPage />} />
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
        {/* Product placeholder — Katalog/CMB chrome deferred; bookmarks land on Product */}
        <Route path="catalog" element={<CoRedirect to="product" />} />
        <Route path="katalog" element={<CoRedirect to="product" />} />
        <Route path="product" element={<ProductShell />} />
        <Route path="product/katalog" element={<CoRedirect to="product" />} />
        <Route path="product/catalog" element={<CoRedirect to="product" />} />
        <Route path="product/costmybusiness/*" element={<CoRedirect to="product" />} />
        <Route path="product/costmybusiness" element={<CoRedirect to="product" />} />
        <Route path="product/cmb" element={<CoRedirect to="product" />} />
        <Route path="customer" element={<CustomerShell />}>
          <Route path=":id" element={<CustomerDetail />} />
        </Route>
        <Route path="partner" element={<CustomerShell />}>
          <Route path=":id" element={<CustomerDetail />} />
        </Route>
        <Route path="contacts" element={<CoRedirect to="customer" />} />
        <Route path="contacts/:id" element={<ContactsIdRedirect />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="projects" element={<ProjectsShell />}>
          <Route path="mine" element={<MyTasksPage />} />
          <Route path="recurring" element={<RecurringRulesPage />} />
          <Route path=":id" element={<ProjectDetail />} />
        </Route>
        <Route path="finance" element={<FinancePage />} />

        <Route path="marketing" element={<MarketingShell />}>
          <Route
            index
            element={<Navigate to={`funnel/organic/${DEFAULT_ORGANIC_CHANNEL}`} replace />}
          />
          <Route path="personas" element={<PersonasPage />} />
          <Route path="styleguide" element={<StyleguidePage />} />
          <Route path="funnel/organic/website" element={<OpenSeoPage />} />
          <Route path="funnel/organic/planung" element={<MarketingPage />} />
          <Route path="funnel/organic/:channel" element={<MarketingPage />} />
          <Route
            path="funnel/organic"
            element={<Navigate to={DEFAULT_ORGANIC_CHANNEL} replace />}
          />
          <Route path="funnel/custom/:channel" element={<MarketingPage />} />
          <Route path="funnel/custom" element={<Navigate to="email" replace />} />
          <Route path="funnel/paid/planung" element={<AdsPage />} />
          <Route path="funnel/paid/:channel" element={<AdsPage />} />
          <Route path="funnel/paid" element={<Navigate to={DEFAULT_PAID_CHANNEL} replace />} />
        </Route>

        <Route path="tools" element={<ToolsPage />} />
        <Route path="tools/cmb/*" element={<CoRedirect to="product" />} />
        <Route path="tools/cmb" element={<CoRedirect to="product" />} />
        <Route path="tools/sortanize/*" element={<SortanizePage />} />
        <Route path="tools/sortanize" element={<SortanizePage />} />
        <Route path="tools/checkmap/*" element={<CoRedirect to="tools" />} />
        <Route path="tools/checkmap" element={<CoRedirect to="tools" />} />
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
        <Route path="checkmap" element={<CoRedirect to="tools" />} />
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
