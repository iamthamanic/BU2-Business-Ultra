/**
 * CustomerPage — Dark-Ops shell stub for `/co/:slug/customer`.
 * Title + lede only; module content lands later. Location: apps/web/src/features/customer/CustomerPage.tsx
 */
import { useI18n } from '../../lib/i18n'

export function CustomerPage() {
  const { t } = useI18n()
  return (
    <div className="stack">
      <header className="funnel-head">
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            {t('customer')}
          </h1>
          <p className="muted page-lede">{t('customerLede')}</p>
        </div>
      </header>
    </div>
  )
}
