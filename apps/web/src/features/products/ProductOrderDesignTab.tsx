/**
 * ProductOrderDesignTab — Auftragsgestaltung (order/offer layout for this product).
 * Location: apps/web/src/features/products/ProductOrderDesignTab.tsx
 */
import { PencilRuler } from '@phosphor-icons/react'
import { useI18n } from '../../lib/i18n'

type Props = {
  readOnly?: boolean
}

export function ProductOrderDesignTab({ readOnly }: Props) {
  const { t } = useI18n()

  return (
    <div className="product-order-design-tab stack">
      <div className="customer-empty-block product-order-design-empty">
        <PencilRuler size={28} weight="regular" aria-hidden />
        <p className="muted" style={{ margin: 0 }}>
          {readOnly ? t('productOrderDesignEmptyReadonly') : t('productOrderDesignEmpty')}
        </p>
      </div>
    </div>
  )
}
