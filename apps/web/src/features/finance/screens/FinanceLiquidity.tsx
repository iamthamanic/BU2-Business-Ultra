/**
 * Finance liquidity tab panel.
 * Location: apps/web/src/features/finance/screens/FinanceLiquidity.tsx
 */
import { useState } from 'react'
import { useI18n } from '../../../lib/i18n'
import { formatEur, formatEurOrDash } from '../financeModel'
import { EmptyFilterBlock, FinanceConnectHint, Tag, useFinance, type NavProps } from './financeScreenShared'

export function FinanceLiquidity({ go, settingsHref, data }: NavProps) {
  const { t } = useI18n()
  const snap = useFinance(data)
  const [horizon, setHorizon] = useState<30 | 60 | 90>(30)
  const hasBalance = snap.balance !== null

  return (
    <div className="finance-screen stack">
      <div className="finance-toolbar">
        <div>
          <h2 className="finance-small-title">{t('financeLiquidityTitle')}</h2>
          <p className="finance-pagehint">{t('financeLiquidityHint')}</p>
        </div>
        <div className="finance-h-tabs" role="group" aria-label={t('financeHorizon')}>
          {([30, 60, 90] as const).map((h) => (
            <button
              key={h}
              type="button"
              className={horizon === h ? 'is-active' : undefined}
              onClick={() => setHorizon(h)}
            >
              {h} {t('financeDays')}
            </button>
          ))}
        </div>
      </div>

      <div className="finance-stats" style={{ marginTop: 0 }}>
        <div className="panel finance-stat">
          <div className="finance-stat-label">{t('financeBalance')}</div>
          <div className="finance-stat-value num">{formatEurOrDash(snap.balance)}</div>
          <div className="finance-stat-foot">
            {hasBalance ? t('financeExampleStart') : t('financeAwaitingData')}
          </div>
        </div>
        <div className="panel finance-stat">
          <div className="finance-stat-label">{t('financeFreeAvailableShort')}</div>
          <div className="finance-stat-value num accent">
            {formatEurOrDash(snap.freeAvailable)}
          </div>
          <div className="finance-stat-foot">{t('financeAfterObligations')}</div>
        </div>
        <div className="panel finance-stat">
          <div className="finance-stat-label">{t('financeLowestProjected')}</div>
          <div className="finance-stat-value num">
            {formatEurOrDash(snap.liquidityMinByHorizon[horizon])}
          </div>
          <div className="finance-stat-foot">
            {t('financeInNext')} {horizon} {t('financeDays')}
          </div>
        </div>
      </div>

      <div className="panel panel-pad">
        <div className="finance-section-head">
          <div>
            <h2>{t('financeBalanceForecast')}</h2>
            <p>{t('financeBalanceForecastHint')}</p>
          </div>
          <div className="finance-legend">
            <span>
              <i /> {t('financeKnownItems')}
            </span>
            <span>
              <i className="dashed" /> {t('financeAssumptions')}
            </span>
          </div>
        </div>
        {hasBalance ? (
          <>
            <svg
              className="finance-chart-area finance-chart-area--tall"
              viewBox="0 0 1000 285"
              preserveAspectRatio="none"
              aria-label={t('financeBalanceForecast')}
            >
              <path
                d="M0 50H1000M0 105H1000M0 160H1000M0 215H1000M0 270H1000"
                stroke="#243041"
                strokeDasharray="4 7"
              />
            </svg>
            <div className="finance-chart-labels">
              <span>{t('financeToday')}</span>
              <span>+7 {t('financeDays')}</span>
              <span>+14 {t('financeDays')}</span>
              <span>+21 {t('financeDays')}</span>
              <span>
                +{horizon} {t('financeDays')}
              </span>
            </div>
          </>
        ) : (
          <FinanceConnectHint settingsHref={settingsHref} />
        )}
      </div>

      <div className="finance-lower-grid">
        <div className="panel panel-pad">
          <div className="finance-section-head">
            <div>
              <h2>{t('financeNextPayments')}</h2>
              <p>{t('financeNextPaymentsHint')}</p>
            </div>
            <button
              type="button"
              className="finance-section-link"
              onClick={() => go('transactions', { txFilter: 'open' })}
            >
              {t('financeViewAll')}
            </button>
          </div>
          {snap.liquidityFlows.length === 0 ? (
            <FinanceConnectHint settingsHref={settingsHref} />
          ) : (
            <div className="finance-flowrows">
              {snap.liquidityFlows.map((f) => (
                <div key={f.title} className="finance-flowrow">
                  <div className="finance-flowdate">{f.date}</div>
                  <div className="finance-flowinfo">
                    <b>{f.title}</b>
                    <span>{f.detail}</span>
                  </div>
                  <div className={`finance-flowprice ${f.amount < 0 ? 'bad' : 'good'}`}>
                    {f.amount > 0 ? '+' : ''}
                    {formatEur(f.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="panel panel-pad">
          <div className="finance-section-head">
            <div>
              <h2>{t('financeReservesBuffer')}</h2>
              <p>{t('financeReservesBufferHint')}</p>
            </div>
            <button type="button" className="finance-section-link" onClick={() => go('settings')}>
              {t('financeChangeRules')}
            </button>
          </div>
          <div className="finance-forecast-label">
            <span className="small">{t('financeTaxReserveManual')}</span>
            <span className="num">{formatEurOrDash(snap.taxReserve)}</span>
          </div>
          <div className="finance-progress">
            <span
              style={{
                width:
                  snap.taxReserve !== null && snap.reserveProgress
                    ? `${Math.min(100, (snap.taxReserve / Math.max(snap.reserveProgress.target, 1)) * 100)}%`
                    : '0%',
              }}
            />
          </div>
          <div className="finance-forecast-label" style={{ marginTop: 17 }}>
            <span className="small">{t('financeOpsBuffer')}</span>
            <span className="num">
              {snap.opsBuffer
                ? `${formatEur(snap.opsBuffer.current)} / ${formatEur(snap.opsBuffer.target)}`
                : '—'}
            </span>
          </div>
          <div className="finance-progress finance-progress--green">
            <span
              style={{
                width: snap.opsBuffer
                  ? `${Math.min(100, (snap.opsBuffer.current / Math.max(snap.opsBuffer.target, 1)) * 100)}%`
                  : '0%',
              }}
            />
          </div>
          <p className="finance-footnote">{t('financeBufferFootnote')}</p>
        </div>
      </div>
    </div>
  )
}

