/**
 * ProductShell — tabbed Product IA under `/co/:slug/product`.
 * L1 hosts Katalog (default) then CostMyBusiness; further Product surfaces can join later.
 * Deep links sync via nested routes (`Outlet`). Location: apps/web/src/features/product/ProductShell.tsx
 */
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Calculator, Cube } from '@phosphor-icons/react'
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
  const onCmb =
    pathname === routes.cmb || pathname.startsWith(`${routes.cmb}/`)

  return (
    <div className="stack mkt-shell">
      <div className="mkt-chrome">
        <MktTabs level="l1" label={t('product')}>
          <MktTab
            active={onKatalog}
            onClick={() => navigate(routes.catalog)}
            label={t('catalog')}
            icon={Cube}
            dataIc="catalog"
          />
          <MktTab
            active={onCmb}
            onClick={() => navigate(routes.cmb)}
            label={t('cmb')}
            icon={Calculator}
            dataIc="cmb"
          />
        </MktTabs>
      </div>
      <Outlet />
    </div>
  )
}
