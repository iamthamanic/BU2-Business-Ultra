/**
 * FinancePage — placeholder department shell (no domain features yet).
 * Location: apps/web/src/features/finance/FinancePage.tsx
 */
import { useI18n } from '../../lib/i18n'

export function FinancePage() {
  const { t } = useI18n()

  return (
    <div className="stack mkt-shell product-shell crm-shell">
      <header className="product-page-head">
        <div>
          <h1 className="section-title product-page-title">{t('finance')}</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {t('financePlaceholder')}
          </p>
        </div>
      </header>
      <div className="panel customer-empty-block" style={{ padding: 28 }}>
        <p className="muted" style={{ margin: 0 }}>
          {t('financePlaceholderHint')}
        </p>
      </div>
    </div>
  )
}
