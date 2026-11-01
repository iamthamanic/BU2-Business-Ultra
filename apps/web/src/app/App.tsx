import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
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
        element={user?.isSuperadmin || user?.isBreakglassOperator ? <AdminPage user={user} onLogout={logout} /> : <Navigate to="/" replace />}
      />
      <Route
        path="/b/:slug/*"
        element={user ? <BusinessShell user={user} onLogout={logout} /> : <Navigate to="/login" replace />}
      >
        <Route index element={<OverviewPage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="marketing" element={<MarketingPage />} />
        <Route path="ads" element={<AdsPage />} />
        <Route path="cmb" element={<CmbPage />} />
        <Route path="checkmap" element={<CheckMapPage />} />
        <Route path="personas" element={<PersonasPage />} />
        <Route path="sortanize" element={<SortanizePage />} />
        <Route path="openseo" element={<OpenSeoPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  )
}
