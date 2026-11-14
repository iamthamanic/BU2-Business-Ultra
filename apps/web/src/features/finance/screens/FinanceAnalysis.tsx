/**
 * Finance analysis tab panel.
 * Location: apps/web/src/features/finance/screens/FinanceAnalysis.tsx
 */
import { useState } from 'react'
import {
  Sparkle,
} from '@phosphor-icons/react'
import { useI18n } from '../../../lib/i18n'
import { formatEur, formatEurOrDash, type FinanceSnapshot } from '../financeModel'
import { EmptyFilterBlock, FinanceConnectHint, Tag, useFinance } from './financeScreenShared'

export function FinanceAnalysis({
  settingsHref,
  data,
}: {
  settingsHref: string
  data?: FinanceSnapshot
}) {
  const { t } = useI18n()
  const snap = useFinance(data)
  const [mode, setMode] = useState<'cost' | 'revenue' | 'result'>('cost')

  const sets = {
    cost: {
      title: t('financeCostTrend'),
      label: t('financeCosts'),
      values: snap.analysis.cost,
      color: '#3d8bfd',
    },
    revenue: {
      title: t('financeRevenueTrend'),
      label: t('financeRevenue'),
      values: snap.analysis.revenue,
      color: '#39bc89',
    },
    result: {
      title: t('financeResultTrend'),
      label: t('financeResult'),
      values: snap.analysis.result,
      color: '#d5a05d',
    },
  }
  const d = sets[mode]
  const max = d.values.length ? Math.max(...d.values) * 1.15 : 1
  const spacing = 112
  const bar = 48
  const months = ['Juni', 'Juli', 'August', 'September', 'Oktober', 'November']

  return (
    <div className="finance-screen stack">
      <div className="finance-toolbar">
        <div>
          <h2 className="finance-small-title">{t('financeDevelopment')}</h2>
          <p className="finance-pagehint">{t('financeDevelopmentHint')}</p>
        </div>
        <div className="finance-h-tabs" role="group" aria-label={t('financeAnalysisKind')}>
          {(['cost', 'revenue', 'result'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={mode === m ? 'is-active' : undefined}
              onClick={() => setMode(m)}
            >
              {sets[m].label}
            </button>
          ))}
        </div>
      </div>

      <div className="finance-analysis-layout">
        <div className="panel panel-pad">
          <div className="finance-section-head">
            <div>
              <h2>{d.title}</h2>
              <p>{t('financeLast6Months')}</p>
            </div>
            <Tag tone="blue">{d.label}</Tag>
          </div>
          {d.values.length === 0 ? (
            <FinanceConnectHint settingsHref={settingsHref} />
          ) : (
            <>
              <svg
                className="finance-chart-bars"
                viewBox="0 0 720 240"
                preserveAspectRatio="none"
                aria-label={d.title}
              >
                {[0, 1, 2, 3, 4].map((i) => (
                  <path
                    key={i}
                    d={`M0 ${22 + i * 42}H720`}
                    stroke="#243041"
                    strokeDasharray="4 7"
                  />
                ))}
                {d.values.map((v, i) => {
                  const height = (v / max) * 182
                  const x = 36 + i * spacing
                  const y = 217 - height
                  return (
                    <g key={i}>
                      <rect
                        x={x}
                        y={y}
                        width={bar}
                        height={height}
                        rx="3"
                        fill={d.color}
                        opacity={i === d.values.length - 1 ? 1 : 0.52}
                      />
                      <text
                        x={x + bar / 2}
                        y={y - 9}
                        fill="#b8c9dc"
                        textAnchor="middle"
                        fontSize="10"
                      >
                        {(Math.round(v / 100) / 10).toFixed(1)}k
                      </text>
                    </g>
                  )
                })}
              </svg>
              <div className="finance-chart-labels">
                {months.slice(0, d.values.length).map((m) => (
                  <span key={m}>{m}</span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="panel panel-pad">
          <div className="finance-section-head">
            <div>
              <h2>{t('financeSpendByCategory')}</h2>
              <p>{t('financeSpendByCategoryHint')}</p>
            </div>
          </div>
          {snap.analysis.categories.length === 0 ? (
            <FinanceConnectHint settingsHref={settingsHref} />
          ) : (
            <div className="finance-list">
              {snap.analysis.categories.map((c) => (
                <div key={c.name} className="finance-listrow">
                  <div style={{ flex: 1 }}>
                    <div className="finance-pips">
                      <span className="finance-pip" style={{ background: c.color }} />
                      <strong>{c.name}</strong>
                    </div>
                    <div className="finance-hbar">
                      <span style={{ width: `${c.pct}%`, background: c.color }} />
                    </div>
                  </div>
                  <strong className="num">{formatEur(c.amount)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="finance-margin-strip">
        <div className="panel finance-margin-block">
          <div className="caps">{t('financeProvisionalResult')}</div>
          <div className={`finance-large num${snap.result !== null && snap.result > 0 ? ' good' : ''}`}>
            {snap.result === null
              ? '—'
              : `${snap.result > 0 ? '+' : ''}${formatEur(snap.result)}`}
          </div>
          <div className="small muted">{t('financeResultFoot')}</div>
        </div>
        <div className="panel finance-margin-block">
          <div className="caps">{t('financeProvisionalMargin')}</div>
          <div className="finance-large num">
            {snap.analysis.marginPct === null
              ? '—'
              : `${snap.analysis.marginPct.toFixed(1).replace('.', ',')} %`}
          </div>
          <div className="small muted">{t('financeMarginHint')}</div>
        </div>
        <div className="panel finance-margin-block">
          <div className="caps">{t('financeTopCostDriver')}</div>
          <div className="finance-large num">
            {snap.analysis.topDriverPct === null
              ? '—'
              : `${snap.analysis.topDriverPct.toFixed(1).replace('.', ',')} %`}
          </div>
          <div className="small muted">{snap.analysis.topDriverName ?? t('financeAwaitingData')}</div>
        </div>
      </div>

      {snap.analysis.cost.length === 0 ? (
        <FinanceConnectHint settingsHref={settingsHref} />
      ) : (
        <div className="finance-insight">
          <Sparkle size={17} aria-hidden />
          <div>
            <strong>{t('financeInsightEmptyTitle')}</strong>
            <p>{t('financeInsightEmptyBody')}</p>
          </div>
        </div>
      )}
    </div>
  )
}

