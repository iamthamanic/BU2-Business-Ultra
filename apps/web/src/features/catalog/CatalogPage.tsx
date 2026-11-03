/**
 * CatalogPage — Katalog surface under Product (UI shell only for now).
 * Route: `/co/:slug/product/katalog`. API remains `/api/b/:slug/catalog`.
 * Location: apps/web/src/features/catalog/CatalogPage.tsx
 */
import { useI18n } from '../../lib/i18n'

export function CatalogPage() {
  const { t } = useI18n()

  return (
    <div className="stack mkt-pane">
      <h1 className="section-title" style={{ margin: 0 }}>
        {t('catalog')}
      </h1>
    </div>
  )
}
