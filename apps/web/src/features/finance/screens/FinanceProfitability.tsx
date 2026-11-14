/**
 * Finance profitability tab panel.
 * Location: apps/web/src/features/finance/screens/FinanceProfitability.tsx
 */
import { useState } from 'react'
import {
  Info,
} from '@phosphor-icons/react'
import { useI18n } from '../../../lib/i18n'
import { formatEur, formatEurOrDash } from '../financeModel'
import { EmptyFilterBlock, FinanceConnectHint, Tag, useFinance, type NavProps } from './financeScreenShared'

export function FinanceProfitability({ go, settingsHref, data }: NavProps) {
  const { t } = useI18n()
  const snap = useFinance(data)
  const [mode, setMode] = useState<'customers' | 'products' | 'projects'>('customers')
  const rows = snap.profitability[mode]
  const titles = {
    customers: t('financeProfitByCustomers'),
    products: t('financeProfitByProducts'),
    projects: t('financeProfitByProjects'),
  }
  const cols = {
    customers: t('financeCustomer'),
    products: t('financeProduct'),
    projects: t('financeProject'),
  }
  const be = snap.profitability.breakEven
  const rev = snap.revenue
  const bePct = be !== null && rev !== null && rev > 0 ? (be / rev) * 100 : 0

  return (
    <div className="finance-screen stack">
      <div className="finance-toolbar">
        <div>
          <h2 className="finance-small-title">{t('financeProfitTitle')}</h2>
          <p className="finance-pagehint">{t('financeProfitHint')}</p>
        </div>
        <div className="finance-h-tabs" role="group" aria-label={t('financeProfitObject')}>
          {(['customers', 'products', 'projects'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={mode === m ? 'is-active' : undefined}
              onClick={() => setMode(m)}
            >
              {m === 'customers'
                ? t('financeCustomers')
                : m === 'products'
                  ? t('financeProducts')
                  : t('financeProjects')}
            </button>
          ))}
        </div>
      </div>

      <div className="finance-stats" style={{ marginTop: 0 }}>
        <div className="panel finance-stat">
          <div className="finance-stat-label">{t('financeRecordedRevenue')}</div>
          <div className="finance-stat-value num">{formatEurOrDash(snap.revenue)}</div>
          <div className="finance-stat-foot">{t('financeInSelectedPeriod')}</div>
        </div>
        <div className="panel finance-stat">
          <div className="finance-stat-label">{t('financeDirectCosts')}</div>
          <div className="finance-stat-value num">
            {formatEurOrDash(snap.profitability.directCosts)}
          </div>
          <div className="finance-stat-foot">{t('financeCostsIncomplete')}</div>
        </div>
        <div className="panel finance-stat">
          <div className="finance-stat-label">{t('financeContribution')}</div>
          <div
            className={`finance-stat-value num${snap.profitability.contribution !== null ? ' good' : ''}`}
          >
            {formatEurOrDash(snap.profitability.contribution)}
          </div>
          <div className="finance-stat-foot">{t('financeBeforeFixed')}</div>
        </div>
      </div>

      <div className="panel">
        <div className="finance-section-head" style={{ padding: '20px 18px 0' }}>
          <div>
            <h2>{titles[mode]}</h2>
            <p>{t('financeContributionFormula')}</p>
          </div>
          <Tag tone="amber">{t('financeAssignmentIncomplete')}</Tag>
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: '0 18px 20px' }}>
            <FinanceConnectHint settingsHref={settingsHref} />
          </div>
        ) : (
          <div className="finance-tablewrap">
            <table className="finance-data-table">
              <thead>
                <tr>
                  <th>{cols[mode]}</th>
                  <th>{t('financeRevenue')}</th>
                  <th>{t('financeDirectCosts')}</th>
                  <th>{t('financeContribution')}</th>
                  <th>{t('financeMargin')}</th>
                  <th>{t('financeColStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([name, revenue, cost]) => {
                  const db = revenue - cost
                  const margin = revenue > 0 ? (100 * db) / revenue : 0
                  return (
                    <tr key={name}>
                      <td>
                        <strong>{name}</strong>
                      </td>
                      <td className="num">{formatEur(revenue)}</td>
                      <td className="num">{formatEur(cost)}</td>
                      <td className="num good">{formatEur(db)}</td>
                      <td className="num">{margin.toFixed(1).replace('.', ',')} %</td>
                      <td>
                        <Tag tone={margin >= 45 ? 'green' : 'amber'}>
                          {margin >= 45 ? t('financePositive') : t('financeReview')}
                        </Tag>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel panel-pad">
        <div className="finance-section-head">
          <div>
            <h2>{t('financeBreakEven')}</h2>
            <p>{t('financeBreakEvenHint')}</p>
          </div>
          <button type="button" className="finance-section-link" onClick={() => go('planning')}>
            {t('financeCalcScenario')}
          </button>
        </div>
        <div className="finance-break-even">
          <div>
            <div className="caps">{t('financeNeededMonthlyRevenue')}</div>
            <div className="finance-boldnumber num" style={{ margin: '9px 0 0' }}>
              {formatEurOrDash(be)}
            </div>
            <div className="finance-section-note">{t('financeBreakEvenNote')}</div>
            {be !== null && rev !== null ? (
              <>
                <div className="finance-be-track">
                  <span className="fixed" style={{ width: `${Math.min(100, bePct)}%` }} />
                  <span className="surplus" style={{ width: `${Math.max(0, 100 - bePct)}%` }} />
                </div>
                <div className="finance-be-labels">
                  <span>
                    Break-even: {formatEur(be)}
                  </span>
                  <span>
                    {t('financeRevenue')}: {formatEur(rev)}
                  </span>
                </div>
              </>
            ) : null}
          </div>
          <div className="finance-infobox">
            <Info size={17} aria-hidden />
            <div>{t('financeProfitInfo')}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

