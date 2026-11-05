/**
 * ProductCalcTab — Legacy CMB workbench layout: centered product root,
 * stem/fan connectors, 5 department columns, result spine.
 * Location: apps/web/src/features/products/ProductCalcTab.tsx
 */
import { Plus, X } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { useI18n } from '../../lib/i18n'
import {
  COST_DEPTS,
  fmtEur,
  initials,
  uid,
  type CostDept,
  type CostPosition,
  type ProductDraft,
} from './productTypes'
import { ProductCalcFan, ProductCalcStem } from './ProductCalcConnectors'

type Props = {
  draft: ProductDraft
  onChange: (patch: Partial<ProductDraft>) => void
  readOnly?: boolean
}

function resolveNet(draft: ProductDraft): { net: number; gross: number } {
  const price = draft.sellingPriceCents / 100
  const tax = draft.taxRateBps / 100
  if (draft.priceKind === 'net') {
    return { net: price, gross: Math.round(price * (1 + tax / 100) * 100) / 100 }
  }
  const net = Math.round((price / (1 + tax / 100)) * 100) / 100
  return { net, gross: price }
}

function pctOf(part: number, whole: number): number | null {
  if (whole <= 0) return null
  return (part / whole) * 100
}

export function ProductCalcTab({ draft, onChange, readOnly }: Props) {
  const { t } = useI18n()
  const { net, gross } = useMemo(() => resolveNet(draft), [draft])
  const deptCount = COST_DEPTS.length

  const enabled = draft.costPositions.filter((p) => p.enabled)
  const directCents = enabled
    .filter((p) => p.dept !== 'overhead')
    .reduce((s, p) => s + (p.amountCents || 0), 0)
  const allocatedCents = enabled
    .filter((p) => p.dept === 'overhead')
    .reduce((s, p) => s + (p.amountCents || 0), 0)
  const costCents = directCents + allocatedCents
  const contributionCents = Math.round(net * 100) - directCents
  const profitCents = Math.round(net * 100) - costCents
  const contribPct = pctOf(contributionCents / 100, net)
  const marginPct = pctOf(profitCents / 100, net)
  const directPct = pctOf(directCents / 100, net)
  const allocPct = pctOf(allocatedCents / 100, net)

  function setPositions(next: CostPosition[]) {
    onChange({ costPositions: next })
  }

  function addPos(dept: CostDept) {
    if (readOnly) return
    setPositions([
      ...draft.costPositions,
      { id: uid('cost'), dept, label: t('productNewPosition'), amountCents: 0, enabled: true },
    ])
  }

  function patchPos(id: string, patch: Partial<CostPosition>) {
    setPositions(draft.costPositions.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  function removePos(id: string) {
    setPositions(draft.costPositions.filter((p) => p.id !== id))
  }

  return (
    <div className="product-tab-calc" data-testid="product-calculator-workbench">
      <div className="product-calc-root-wrap">
        <div className="product-price-card panel">
          <div className="product-price-head">
            <span className="product-price-mark" aria-hidden>
              {initials(draft.name || t('product')).slice(0, 1)}
            </span>
            <strong>{draft.name.trim() || t('product')}</strong>
          </div>
          <div className="product-price-grid">
            <label className="product-field">
              <span className="label">{t('productSellGross')}</span>
              <input
                className="input"
                type="number"
                min={0}
                step={0.01}
                disabled={readOnly}
                value={(draft.sellingPriceCents / 100).toFixed(2)}
                onChange={(e) =>
                  onChange({
                    sellingPriceCents: Math.max(0, Math.round(parseFloat(e.target.value || '0') * 100)),
                  })
                }
              />
            </label>
            <label className="product-field">
              <span className="label">{t('productVat')}</span>
              <input
                className="input"
                type="number"
                min={0}
                max={99}
                disabled={readOnly}
                value={draft.taxRateBps / 100}
                onChange={(e) =>
                  onChange({
                    taxRateBps: Math.round(Math.min(99, Math.max(0, parseFloat(e.target.value || '0'))) * 100),
                  })
                }
              />
            </label>
            <label className="product-field">
              <span className="label">{t('productPriceKind')}</span>
              <select
                className="input"
                disabled={readOnly}
                value={draft.priceKind}
                onChange={(e) => onChange({ priceKind: e.target.value === 'net' ? 'net' : 'gross' })}
              >
                <option value="gross">{t('productPriceGross')}</option>
                <option value="net">{t('productPriceNet')}</option>
              </select>
            </label>
          </div>
          <div className="product-net-box">
            <span className="label">{t('productNetProceeds')}</span>
            <strong className="kpi">{fmtEur(Math.round(net * 100))}</strong>
            <span className="muted product-net-note">{t('productVatNote')}</span>
            <span className="muted">
              {t('productGrossLabel')}: {fmtEur(Math.round(gross * 100))} · {t('productCostsLabel')}:{' '}
              {fmtEur(costCents)}
            </span>
          </div>
        </div>
      </div>

      <div className="product-calc-connectors product-calc-connectors--desk">
        <ProductCalcStem />
        <ProductCalcFan branches={deptCount} direction="down" />
      </div>

      <div className="product-cost-cols" data-testid="department-grid">
        {COST_DEPTS.map((dept) => {
          const items = draft.costPositions.filter((p) => p.dept === dept.id)
          const sum = items.filter((p) => p.enabled).reduce((s, p) => s + p.amountCents, 0)
          const pct = net > 0 ? ((sum / 100) / net) * 100 : 0
          return (
            <section key={dept.id} className="product-cost-col panel" style={{ ['--dept' as string]: dept.accent }}>
              <header className="product-cost-col-head">
                <span className="product-cost-letter" aria-hidden>
                  {t(dept.labelKey as 'productDeptMarketing').charAt(0)}
                </span>
                <strong>{t(dept.labelKey as 'productDeptMarketing')}</strong>
              </header>
              <p className="product-cost-sum kpi">{fmtEur(sum)}</p>
              <p className="muted product-cost-pct">
                {pct.toFixed(1)} % {t('productOfNet')}
              </p>
              <button
                type="button"
                className="btn product-cost-add"
                disabled={readOnly}
                onClick={() => addPos(dept.id)}
              >
                <Plus size={12} weight="bold" aria-hidden />
                {t('productAddPosition')}
              </button>
              <ul className="product-cost-list">
                {items.map((p) => (
                  <li key={p.id} className={`product-cost-item${p.enabled ? ' is-on' : ''}`}>
                    <label className="product-cost-check">
                      <input
                        type="checkbox"
                        checked={p.enabled}
                        disabled={readOnly}
                        onChange={(e) => patchPos(p.id, { enabled: e.target.checked })}
                      />
                      <span className="sr-only">{t('productEnablePos')}</span>
                    </label>
                    <div className="product-cost-body">
                      <input
                        className="input product-cost-label"
                        value={p.label}
                        disabled={readOnly}
                        onChange={(e) => patchPos(p.id, { label: e.target.value })}
                      />
                      <input
                        className="input product-cost-amt"
                        type="number"
                        min={0}
                        step={0.01}
                        disabled={readOnly}
                        value={(p.amountCents / 100).toFixed(2)}
                        onChange={(e) =>
                          patchPos(p.id, {
                            amountCents: Math.max(0, Math.round(parseFloat(e.target.value || '0') * 100)),
                          })
                        }
                      />
                    </div>
                    {!readOnly ? (
                      <button
                        type="button"
                        className="btn icon-btn"
                        aria-label={t('productRemovePos')}
                        onClick={() => removePos(p.id)}
                      >
                        <X size={12} weight="bold" aria-hidden />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>

      <div className="product-calc-connectors product-calc-connectors--desk">
        <ProductCalcFan branches={deptCount} direction="up" />
        <ProductCalcStem />
      </div>

      <div className="product-result-spine" role="region" aria-label={t('productResultSpine')}>
        <SpineCell
          label={t('productSpineDirect')}
          value={fmtEur(directCents)}
          sub={directPct != null ? `${directPct.toFixed(1)} % ${t('productOfNet')}` : undefined}
          tone="cost"
          negative={directCents < 0}
        />
        <span className="product-spine-arrow" aria-hidden>
          →
        </span>
        <SpineCell
          label={t('productSpineContribution')}
          value={fmtEur(contributionCents)}
          sub={contribPct != null ? `${contribPct.toFixed(1)} %` : undefined}
          tone="profit"
          negative={contributionCents < 0}
        />
        <span className="product-spine-arrow" aria-hidden>
          →
        </span>
        <SpineCell
          label={t('productSpineAllocated')}
          value={fmtEur(allocatedCents)}
          sub={allocPct != null ? `${allocPct.toFixed(1)} % ${t('productOfNet')}` : undefined}
          tone="cost"
          negative={allocatedCents < 0}
        />
        <span className="product-spine-arrow" aria-hidden>
          →
        </span>
        <SpineCell
          label={t('productSpineProfit')}
          value={fmtEur(profitCents)}
          sub={t('productSpineFullyLoaded')}
          tone="profit"
          negative={profitCents < 0}
          emphasize
        />
        <span className="product-spine-arrow" aria-hidden>
          →
        </span>
        <SpineCell
          label={t('productSpineMargin')}
          value={marginPct != null ? `${marginPct.toFixed(1)} %` : '—'}
          sub={t('productOfNet')}
          tone="result"
          negative={marginPct != null && marginPct < 0}
          emphasize
        />
      </div>
    </div>
  )
}

function SpineCell({
  label,
  value,
  sub,
  tone,
  negative,
  emphasize,
}: {
  label: string
  value: string
  sub?: string
  tone: 'cost' | 'profit' | 'result'
  negative?: boolean
  emphasize?: boolean
}) {
  const neg = negative && (tone === 'profit' || tone === 'result')
  return (
    <div
      className={`product-spine-cell panel is-${tone}${neg ? ' is-cost' : ''}${emphasize ? ' is-emphasize' : ''}`}
    >
      <span className="label">{label}</span>
      <strong className="kpi">{value}</strong>
      {sub ? <span className="muted">{sub}</span> : null}
    </div>
  )
}
