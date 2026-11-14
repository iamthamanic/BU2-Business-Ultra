/**
 * Finance overview tab panel.
 * Location: apps/web/src/features/finance/screens/FinanceOverview.tsx
 */
import {
  ArrowRight,
  CalendarBlank,
  CaretRight,
  ChartLineUp,
  Clock,
  Warning,
} from '@phosphor-icons/react'
import { useI18n } from '../../../lib/i18n'
import { formatEur, formatEurOrDash } from '../financeModel'
import {
  EmptyFilterBlock,
  FinanceConnectHint,
  Tag,
  useFinance,
  type NavProps,
} from './financeScreenShared'

export function FinanceOverview({ go, settingsHref, data }: NavProps) {
  const { t } = useI18n()
  const ov = useFinance(data)
  const reservePct =
    ov.reserveProgress && ov.reserveProgress.target > 0
      ? Math.round((ov.reserveProgress.current / ov.reserveProgress.target) * 100)
      : 0
  const hasMoney = ov.balance !== null || ov.freeAvailable !== null
  const hasStats = ov.revenue !== null || ov.costs !== null || ov.result !== null

  return (
    <div className="finance-screen stack">
      <div className="finance-overview-grid">
        <div className="panel finance-hero">
          <div className="finance-hero-top">
            <ChartLineUp size={17} weight="regular" className="finance-ic-accent" aria-hidden />
            {t('financeFreeAvailable')}
            <Tag tone="blue">{t('financeEstimate')}</Tag>
          </div>
          <div className="finance-hero-value num">
            {formatEurOrDash(ov.freeAvailable, 2)}
          </div>
          <p className="finance-hero-desc">
            {hasMoney ? t('financeFreeAvailableHint') : t('financeNoDataHint')}
          </p>
          <div className="finance-money-bridge">
            <div className="finance-bridge-piece">
              <span className="finance-bridge-label">{t('financeBalance')}</span>
              <div className="finance-bridge-value num">{formatEurOrDash(ov.balance)}</div>
            </div>
            <div className="finance-bridge-piece">
              <span className="finance-bridge-label">{t('financeObligations')}</span>
              <div className="finance-bridge-value num">
                {formatEurOrDash(ov.obligations)}
              </div>
            </div>
            <div className="finance-bridge-piece">
              <span className="finance-bridge-label">{t('financeReserves')}</span>
              <div className="finance-bridge-value num">{formatEurOrDash(ov.reserves)}</div>
            </div>
          </div>
        </div>

        <div className="panel finance-hero-secondary">
          <div className="finance-hero-secondary-head">
            <div>
              <span className="muted small">{t('financeLiquidityOutlook')}</span>
              <div className="finance-hero-secondary-value num">
                {ov.liquidityOutlook === null
                  ? '—'
                  : `${ov.liquidityOutlook > 0 ? '+' : ''}${formatEur(ov.liquidityOutlook)}`}
              </div>
              <span className="small muted">{t('financeLiquidityOutlookHint')}</span>
            </div>
            {ov.liquidityOutlook !== null && ov.liquidityOutlook > 0 ? (
              <Tag tone="green">{t('financePositive')}</Tag>
            ) : (
              <Tag>{t('financeNoSource')}</Tag>
            )}
          </div>
          <div>
            <div className="finance-forecast-label">
              <span className="small muted">{t('financePlannedReserves')}</span>
              <span className="small num">
                {ov.reserveProgress
                  ? `${formatEur(ov.reserveProgress.current)} / ${formatEur(ov.reserveProgress.target)}`
                  : '—'}
              </span>
            </div>
            <div className="finance-mini-progress">
              <span style={{ width: `${reservePct}%` }} />
            </div>
          </div>
          <div className="finance-secondary-item">
            <span>{t('financeNextPayment')}</span>
            <strong>{ov.nextPayment ?? '—'}</strong>
          </div>
          <div className="finance-secondary-item">
            <span>{t('financeOpenIncoming')}</span>
            <strong className="num">{formatEurOrDash(ov.openIncoming)}</strong>
          </div>
          <button type="button" className="btn finance-btn-sm" onClick={() => go('liquidity')}>
            {t('financeViewForecast')}
            <CaretRight size={14} weight="bold" aria-hidden />
          </button>
        </div>
      </div>

      <div className="finance-stats">
        <div className="panel finance-stat">
          <div className="finance-stat-label">
            {t('financeRecordedRevenue')}
            <ChartLineUp size={14} aria-hidden />
          </div>
          <div className="finance-stat-value num">{formatEurOrDash(ov.revenue)}</div>
          <div className="finance-stat-foot">
            {ov.revenueDeltaPct !== null ? (
              <>
                <strong className="good">
                  +{ov.revenueDeltaPct.toFixed(1).replace('.', ',')} %
                </strong>{' '}
                <span>{t('financeVsPeriod')}</span>
              </>
            ) : (
              <span>{t('financeAwaitingData')}</span>
            )}
          </div>
        </div>
        <div className="panel finance-stat">
          <div className="finance-stat-label">
            {t('financeRecordedCosts')}
            <ArrowRight size={14} aria-hidden />
          </div>
          <div className="finance-stat-value num">{formatEurOrDash(ov.costs)}</div>
          <div className="finance-stat-foot">
            {ov.topCostShare ? (
              <>
                {t('financeTopCostShare')}:{' '}
                <span className="finance-stat-emph">{ov.topCostShare}</span>
              </>
            ) : (
              <span>{t('financeAwaitingData')}</span>
            )}
          </div>
        </div>
        <div className="panel finance-stat">
          <div className="finance-stat-label">
            {t('financeProvisionalResult')}
            <Tag>{t('financeNoTaxCalc')}</Tag>
          </div>
          <div className={`finance-stat-value num${ov.result !== null && ov.result > 0 ? ' good' : ''}`}>
            {ov.result === null
              ? '—'
              : `${ov.result > 0 ? '+' : ''}${formatEur(ov.result)}`}
          </div>
          <div className="finance-stat-foot">
            {hasStats ? t('financeResultFoot') : t('financeAwaitingData')}
          </div>
        </div>
      </div>

      <div className="finance-detail-grid">
        <div className="panel panel-pad">
          <div className="finance-section-head">
            <div>
              <h2>{t('financeMoneyTrend')}</h2>
              <p>{t('financeMoneyTrendHint')}</p>
            </div>
            <button type="button" className="finance-section-link" onClick={() => go('liquidity')}>
              {t('financeViewDetails')}
            </button>
          </div>
          {hasMoney ? (
            <>
              <div className="finance-legend">
                <span>
                  <i /> {t('financePastTrend')}
                </span>
                <span>
                  <i className="dashed" /> {t('financeExpectedTrend')}
                </span>
              </div>
              <svg
                className="finance-chart-area"
                viewBox="0 0 710 226"
                preserveAspectRatio="none"
                aria-label={t('financeMoneyTrend')}
              >
                <path
                  d="M0 47H710M0 94H710M0 141H710M0 188H710"
                  stroke="#243041"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
              </svg>
            </>
          ) : (
            <FinanceConnectHint settingsHref={settingsHref} />
          )}
        </div>

        <div className="panel panel-pad">
          <div className="finance-section-head">
            <div>
              <h2>{t('financeNowImportant')}</h2>
              <p>{t('financeNowImportantHint')}</p>
            </div>
            {ov.alerts.length > 0 ? (
              <Tag tone="amber">
                {ov.alerts.length} {t('financeHints')}
              </Tag>
            ) : !hasMoney ? (
              <Tag>{t('financeNoSource')}</Tag>
            ) : (
              <Tag>{t('financeNoAlerts')}</Tag>
            )}
          </div>
          {ov.alerts.length === 0 ? (
            hasMoney ? (
              <EmptyFilterBlock title={t('financeNoAlertsTitle')} hint={t('financeNoAlertsHint')} />
            ) : (
              <FinanceConnectHint settingsHref={settingsHref} />
            )
          ) : (
            <div className="finance-alerts">
              {ov.alerts.map((a) => (
                <div key={a.id} className="finance-alert-row">
                  <div className={`finance-alert-icon finance-alert-icon--${a.tone}`}>
                    {a.tone === 'red' ? (
                      <Clock size={16} aria-hidden />
                    ) : a.tone === 'blue' ? (
                      <CalendarBlank size={16} aria-hidden />
                    ) : (
                      <Warning size={16} aria-hidden />
                    )}
                  </div>
                  <div className="finance-alert-info">
                    <strong>{a.title}</strong>
                    <span>{a.detail}</span>
                  </div>
                  <button
                    type="button"
                    className="finance-alert-open"
                    title={t('financeOpen')}
                    onClick={() =>
                      go(a.go, a.id === 'overdue' ? { txFilter: 'open' } : undefined)
                    }
                  >
                    <CaretRight size={16} aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="finance-trust">
            <span>{t('financeNoLiveUntilConnected')}</span>
            <button type="button" className="finance-section-link" onClick={() => go('settings')}>
              {t('financeDataOrigin')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

