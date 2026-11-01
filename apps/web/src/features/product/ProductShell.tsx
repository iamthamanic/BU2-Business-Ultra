/**
 * ProductShell — tabbed Product IA under `/co/:slug/product`.
 * L1 hosts Katalog (default); further Product surfaces can join this chrome later.
 * Deep links sync via nested routes (`Outlet`). Location: apps/web/src/features/product/ProductShell.tsx
 */
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Package } from '@phosphor-icons/react'
import { MktTab, MktTabs } from '../../components/MktTabs'
import { companyRoutes } from '../../lib/companyPaths'
import { useI18n } from '../../lib/i18n'

export function ProductShell() {
  const { slug } = useParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { t } = useI18n()

  if (!slug) return null

  const routes = companyRoutes(slug)
  const onKatalog =
    pathname === routes.catalog || pathname.startsWith(`${routes.catalog}/`)

  return (
    <div className="stack mkt-shell">
      <div className="mkt-chrome">
        <MktTabs level="l1" label={t('product')}>
          <MktTab
            active={onKatalog}
            onClick={() => navigate(routes.catalog)}
            label={t('catalog')}
            icon={Package}
            dataIc="catalog"
          />
        </MktTabs>
      </div>
      <Outlet />
    </div>
  )
}
