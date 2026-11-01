/**
 * ProductPage — Dark-Ops shell stub for `/co/:slug/product`.
 * Title + lede only; module content lands later. Location: apps/web/src/features/product/ProductPage.tsx
 */
import { useI18n } from '../../lib/i18n'

export function ProductPage() {
  const { t } = useI18n()
  return (
    <div className="stack">
      <header className="funnel-head">
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            {t('product')}
          </h1>
          <p className="muted page-lede">{t('productLede')}</p>
        </div>
      </header>
    </div>
  )
}
