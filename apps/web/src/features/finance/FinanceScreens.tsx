/**
 * Finance tab panels — overview through accounts (prototype parity, demo data).
 * Location: apps/web/src/features/finance/FinanceScreens.tsx
 */
import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowRight,
  CalendarBlank,
  CaretRight,
  ChartLineUp,
  Clock,
  Info,
  Lightning,
  MagnifyingGlass,
  Plus,
  Sparkle,
  Warning,
} from '@phosphor-icons/react'
import type { MessageKey } from '../../i18n/messages'
import { useI18n } from '../../lib/i18n'
import {
  FINANCE_DEMO_AS_OF,
  financeAlerts,
  financeAnalysis,
  financeLiquidityFlows,
  financeOverview as ov,
  financeProfitability,
  financeRecurring,
  financeTransactions,
  formatEur,
  type FinanceTx,
} from './financeDemo'

export type FinanceScreen =
  | 'overview'
  | 'transactions'
  | 'analysis'
  | 'liquidity'
  | 'profitability'
  | 'planning'
  | 'settings'

export type TxFilter = 'all' | 'income' | 'expense' | 'open' | 'recurring'

type NavProps = {
  go: (screen: FinanceScreen, opts?: { txFilter?: TxFilter }) => void
}

function Tag({
  children,
  tone,
}: {
  children: ReactNode
  tone?: 'green' | 'amber' | 'red' | 'blue' | 'neutral'
}) {
  const cls = tone && tone !== 'neutral' ? ` finance-tag--${tone}` : ''
  return <span className={`finance-tag${cls}`}>{children}</span>
}

function statusTag(status: FinanceTx['status']) {
  const tone = status === 'Bezahlt' ? 'green' : status === 'Geplant' ? 'blue' : 'red'
  return <Tag tone={tone}>{status}</Tag>
}

/* ─── Overview ─────────────────────────────────────────────── */

export function FinanceOverview({ go }: NavProps) {
  const { t } = useI18n()
  const reservePct = Math.round(
    (ov.reserveProgress.current / ov.reserveProgress.target) * 100,
  )

  return (
    <div className="finance-screen stack">
      <div className="finance-overview-grid">
        <div className="panel finance-hero">
          <div className="finance-hero-top">
            <ChartLineUp size={17} weight="regular" className="finance-ic-accent" aria-hidden />
            {t('financeFreeAvailable')}
            <Tag tone="blue">{t('financeEstimate')}</Tag>
          </div>
          <div className="finance-hero-value num">{formatEur(ov.freeAvailable, 2)}</div>
          <p className="finance-hero-desc">{t('financeFreeAvailableHint')}</p>
          <div className="finance-money-bridge">
            <div className="finance-bridge-piece">
              <span className="finance-bridge-label">{t('financeBalance')}</span>
              <div className="finance-bridge-value num">{formatEur(ov.balance)}</div>
            </div>
            <div className="finance-bridge-piece">
              <span className="finance-bridge-label">{t('financeObligations')}</span>
              <div className="finance-bridge-value num">{formatEur(ov.obligations)}</div>
            </div>
            <div className="finance-bridge-piece">
              <span className="finance-bridge-label">{t('financeReserves')}</span>
              <div className="finance-bridge-value num">{formatEur(ov.reserves)}</div>
            </div>
          </div>
        </div>

        <div className="panel finance-hero-secondary">
          <div className="finance-hero-secondary-head">
            <div>
              <span className="muted small">{t('financeLiquidityOutlook')}</span>
              <div className="finance-hero-secondary-value num">
                +{formatEur(ov.liquidityOutlook)}
              </div>
              <span className="small muted">{t('financeLiquidityOutlookHint')}</span>
            </div>
            <Tag tone="green">{t('financePositive')}</Tag>
          </div>
          <div>
            <div className="finance-forecast-label">
              <span className="small muted">{t('financePlannedReserves')}</span>
              <span className="small num">
                {formatEur(ov.reserveProgress.current)} / {formatEur(ov.reserveProgress.target)}
              </span>
            </div>
            <div className="finance-mini-progress">
              <span style={{ width: `${reservePct}%` }} />
            </div>
          </div>
          <div className="finance-secondary-item">
            <span>{t('financeNextPayment')}</span>
            <strong>{ov.nextPayment.when}</strong>
          </div>
          <div className="finance-secondary-item">
            <span>{t('financeOpenIncoming')}</span>
            <strong className="num">{formatEur(ov.openIncoming)}</strong>
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
          <div className="finance-stat-value num">{formatEur(ov.revenue)}</div>
          <div className="finance-stat-foot">
            <strong className="good">+{ov.revenueDeltaPct.toFixed(1).replace('.', ',')} %</strong>{' '}
            <span>{t('financeVsPeriod')}</span>
          </div>
        </div>
        <div className="panel finance-stat">
          <div className="finance-stat-label">
            {t('financeRecordedCosts')}
            <ArrowRight size={14} aria-hidden />
          </div>
          <div className="finance-stat-value num">{formatEur(ov.costs)}</div>
          <div className="finance-stat-foot">
            {t('financeTopCostShare')}: <span className="finance-stat-emph">{ov.topCostShare}</span>
          </div>
        </div>
        <div className="panel finance-stat">
          <div className="finance-stat-label">
            {t('financeProvisionalResult')}
            <Tag>{t('financeNoTaxCalc')}</Tag>
          </div>
          <div className="finance-stat-value num good">+{formatEur(ov.result)}</div>
          <div className="finance-stat-foot">{t('financeResultFoot')}</div>
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
            <defs>
              <linearGradient id="financeAreaBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3d8bfd" stopOpacity=".17" />
                <stop offset="100%" stopColor="#3d8bfd" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 47H710M0 94H710M0 141H710M0 188H710"
              stroke="#243041"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
            <path
              d="M0 140L45 125L85 136L135 108L185 118L227 103L268 118L310 91L350 99L350 225H0Z"
              fill="url(#financeAreaBlue)"
            />
            <path
              d="M0 140L45 125L85 136L135 108L185 118L227 103L268 118L310 91L350 99"
              fill="none"
              stroke="#3d8bfd"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path
              d="M350 99L395 106L437 77L477 88L522 57L566 77L613 42L659 62L710 39"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeDasharray="7 5"
              strokeLinejoin="round"
            />
            <line
              x1="350"
              y1="18"
              x2="350"
              y2="216"
              stroke="#5d7794"
              strokeDasharray="3 5"
            />
            <circle cx="350" cy="99" r="5" fill="#3d8bfd" stroke="#10161e" strokeWidth="3" />
          </svg>
          <div className="finance-chart-labels">
            <span>01. Okt</span>
            <span>15. Okt</span>
            <span>01. Nov</span>
            <span>15. Nov</span>
            <span>30. Nov</span>
          </div>
        </div>

        <div className="panel panel-pad">
          <div className="finance-section-head">
            <div>
              <h2>{t('financeNowImportant')}</h2>
              <p>{t('financeNowImportantHint')}</p>
            </div>
            <Tag tone="amber">3 {t('financeHints')}</Tag>
          </div>
          <div className="finance-alerts">
            {financeAlerts.map((a) => (
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
          <div className="finance-trust">
            <span>{t('financeDemoNoLive')}</span>
            <span>
              {t('financeLastDemoUpdate')}: {FINANCE_DEMO_AS_OF.slice(0, 5)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Transactions ─────────────────────────────────────────── */

type TxProps = NavProps & {
  filter: TxFilter
  setFilter: (f: TxFilter) => void
  onToast: (msg: string) => void
}

export function FinanceTransactions({ filter, setFilter, onToast }: TxProps) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<FinanceTx | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return financeTransactions.filter((x) => {
      if (filter === 'income' && x.kind !== 'income') return false
      if (filter === 'expense' && x.kind !== 'expense') return false
      if (filter === 'open' && !['Überfällig', 'Geplant'].includes(x.status)) return false
      if (filter === 'recurring' && !x.recurring) return false
      if (!q) return true
      return [x.name, x.category, x.project, x.desc, x.source].join(' ').toLowerCase().includes(q)
    })
  }, [filter, search])

  function exportCsv() {
    const head = [
      'Datum',
      'Name',
      'Beschreibung',
      'Kategorie',
      'Projekt',
      'Status',
      'Quelle',
      'Betrag EUR',
    ]
    const rows = financeTransactions.map((x) => [
      x.date,
      x.name,
      x.desc,
      x.category,
      x.project,
      x.status,
      x.source,
      String(x.amount),
    ])
    const csv =
      '\ufeff' +
      [head, ...rows]
        .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(';'))
        .join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'business-ultra-finance-beispieldaten.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    onToast(t('financeCsvExported'))
  }

  const filters: { id: TxFilter; label: string }[] = [
    { id: 'all', label: t('financeFilterAll') },
    { id: 'income', label: t('financeFilterIncome') },
    { id: 'expense', label: t('financeFilterExpense') },
    { id: 'open', label: t('financeFilterOpen') },
    { id: 'recurring', label: t('financeFilterRecurring') },
  ]

  return (
    <div className="finance-screen stack">
      <div className="finance-toolbar">
        <div>
          <h2 className="finance-small-title">{t('financeAllMovements')}</h2>
          <p className="finance-pagehint">{t('financeAllMovementsHint')}</p>
        </div>
        <button type="button" className="btn" onClick={exportCsv}>
          {t('financeExportCsv')}
        </button>
      </div>

      <div className="panel panel-pad">
        <div className="finance-toolbar finance-toolbar--tight">
          <div className="finance-filter-group" role="group" aria-label={t('financeFilterStatus')}>
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`finance-filter-btn${filter === f.id ? ' is-active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="finance-searchbox">
            <MagnifyingGlass size={14} aria-hidden />
            <input
              aria-label={t('financeSearchTx')}
              placeholder={t('financeSearchTxPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="finance-tablewrap">
          <table className="finance-data-table">
            <thead>
              <tr>
                <th>{t('financeColDate')}</th>
                <th>{t('financeColParty')}</th>
                <th>{t('financeColCategory')}</th>
                <th>{t('financeColStatus')}</th>
                <th>{t('financeColSource')}</th>
                <th>{t('financeColAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="finance-empty">
                    <strong>{t('financeTxEmpty')}</strong>
                    {t('financeTxEmptyHint')}
                  </td>
                </tr>
              ) : (
                filtered.map((x) => (
                  <tr key={x.id} onClick={() => setSelected(x)}>
                    <td className="mono">{x.date}</td>
                    <td>
                      <strong>{x.name}</strong>
                      <div className="tiny muted" style={{ marginTop: 3 }}>
                        {x.desc}
                      </div>
                    </td>
                    <td>
                      {x.category}
                      <div className="tiny dim" style={{ marginTop: 3 }}>
                        {x.project}
                      </div>
                    </td>
                    <td>{statusTag(x.status)}</td>
                    <td>{x.source}</td>
                    <td className={`finance-amount ${x.amount > 0 ? 'in' : 'out'}`}>
                      {x.amount > 0 ? '+' : ''}
                      {formatEur(x.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="finance-tablefooter">
          <span>
            {filtered.length} {t('financeOf')} {financeTransactions.length}{' '}
            {t('financeSampleEntries')}
          </span>
          <span>{t('financeAmountsNote')}</span>
        </div>
      </div>

      <div className="finance-lower-grid">
        <div className="panel panel-pad">
          <div className="finance-section-head">
            <div>
              <h2>{t('financeOpenItems')}</h2>
              <p>{t('financeOpenItemsHint')}</p>
            </div>
          </div>
          <div className="finance-metric-flex">
            <div>
              <div className="caps">{t('financeOpenIncome')}</div>
              <div className="finance-boldnumber num" style={{ marginTop: 6 }}>
                {formatEur(2150)}
              </div>
            </div>
            <div>
              <div className="caps">{t('financePlannedExpenses')}</div>
              <div className="finance-boldnumber num" style={{ marginTop: 6 }}>
                {formatEur(4300)}
              </div>
            </div>
          </div>
        </div>
        <div className="panel panel-pad">
          <div className="finance-section-head">
            <div>
              <h2>{t('financeRecurringExpenses')}</h2>
              <p>{t('financeRecurringHint')}</p>
            </div>
          </div>
          <div className="finance-list">
            {financeRecurring.map((r) => (
              <div key={r.name} className="finance-listrow">
                <div>
                  <strong>{r.name}</strong>
                  <div className="finance-detail">{r.detail}</div>
                </div>
                <strong className="num">{formatEur(r.amount)}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selected ? (
        <div
          className="bu-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="finance-tx-modal-title"
          onClick={() => setSelected(null)}
        >
          <div
            className="bu-modal panel crm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="bu-modal-head">
              <div>
                <h2 id="finance-tx-modal-title">{selected.name}</h2>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  {selected.desc}
                </p>
              </div>
              <button type="button" className="btn ghost" onClick={() => setSelected(null)}>
                {t('closeMenu')}
              </button>
            </header>
            <div className="finance-list">
              <div className="finance-listrow">
                <span className="muted">{t('financeColAmount')}</span>
                <strong className="num">
                  {selected.amount > 0 ? '+' : ''}
                  {formatEur(selected.amount)}
                </strong>
              </div>
              <div className="finance-listrow">
                <span className="muted">{t('financeColStatus')}</span>
                {statusTag(selected.status)}
              </div>
              <div className="finance-listrow">
                <span className="muted">{t('financeColDate')}</span>
                <strong>{selected.date}</strong>
              </div>
              <div className="finance-listrow">
                <span className="muted">{t('financeAssignment')}</span>
                <strong>
                  {selected.project} / {selected.category}
                </strong>
              </div>
              <div className="finance-listrow">
                <span className="muted">{t('financeColSource')}</span>
                <strong>{selected.source}</strong>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ─── Analysis ─────────────────────────────────────────────── */

export function FinanceAnalysis() {
  const { t } = useI18n()
  const [mode, setMode] = useState<'cost' | 'revenue' | 'result'>('cost')

  const sets = {
    cost: {
      title: t('financeCostTrend'),
      label: t('financeCosts'),
      values: financeAnalysis.cost,
      color: '#3d8bfd',
    },
    revenue: {
      title: t('financeRevenueTrend'),
      label: t('financeRevenue'),
      values: financeAnalysis.revenue,
      color: '#39bc89',
    },
    result: {
      title: t('financeResultTrend'),
      label: t('financeResult'),
      values: financeAnalysis.result,
      color: '#d5a05d',
    },
  }
  const d = sets[mode]
  const max = Math.max(...d.values) * 1.15
  const spacing = 112
  const bar = 48

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
                    opacity={i === 5 ? 1 : 0.52}
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
            <span>Juni</span>
            <span>Juli</span>
            <span>August</span>
            <span>September</span>
            <span>Oktober</span>
            <span>November</span>
          </div>
        </div>

        <div className="panel panel-pad">
          <div className="finance-section-head">
            <div>
              <h2>{t('financeSpendByCategory')}</h2>
              <p>{t('financeSpendByCategoryHint')}</p>
            </div>
          </div>
          <div className="finance-list">
            {financeAnalysis.categories.map((c) => (
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
        </div>
      </div>

      <div className="finance-margin-strip">
        <div className="panel finance-margin-block">
          <div className="caps">{t('financeProvisionalResult')}</div>
          <div className="finance-large num good">+{formatEur(ov.result)}</div>
          <div className="small muted">{t('financeResultFoot')}</div>
        </div>
        <div className="panel finance-margin-block">
          <div className="caps">{t('financeProvisionalMargin')}</div>
          <div className="finance-large num">
            {financeAnalysis.marginPct.toFixed(1).replace('.', ',')} %
          </div>
          <div className="small muted">{t('financeMarginHint')}</div>
        </div>
        <div className="panel finance-margin-block">
          <div className="caps">{t('financeTopCostDriver')}</div>
          <div className="finance-large num">
            {financeAnalysis.topDriverPct.toFixed(1).replace('.', ',')} %
          </div>
          <div className="small muted">Externe Leistungen</div>
        </div>
      </div>

      <div className="finance-insight">
        <Sparkle size={17} aria-hidden />
        <div>
          <strong>{t('financeInsightTitle')}</strong>
          <p>{t('financeInsightBody')}</p>
        </div>
      </div>
    </div>
  )
}

/* ─── Liquidity ────────────────────────────────────────────── */

export function FinanceLiquidity({ go }: NavProps) {
  const { t } = useI18n()
  const [horizon, setHorizon] = useState<30 | 60 | 90>(30)
  const mins: Record<30 | 60 | 90, number> = { 30: 18900, 60: 16900, 90: 12400 }

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
          <div className="finance-stat-value num">{formatEur(ov.balance)}</div>
          <div className="finance-stat-foot">{t('financeExampleStart')}</div>
        </div>
        <div className="panel finance-stat">
          <div className="finance-stat-label">{t('financeFreeAvailableShort')}</div>
          <div className="finance-stat-value num accent">{formatEur(ov.freeAvailable)}</div>
          <div className="finance-stat-foot">{t('financeAfterObligations')}</div>
        </div>
        <div className="panel finance-stat">
          <div className="finance-stat-label">{t('financeLowestProjected')}</div>
          <div className="finance-stat-value num">{formatEur(mins[horizon])}</div>
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
          <path
            d="M20 118L130 101L210 142L300 122L410 161L490 147L610 109"
            stroke="#3d8bfd"
            strokeWidth="3.5"
            fill="none"
            strokeLinejoin="round"
          />
          <path
            d="M610 109L680 111L750 79L825 90L915 57L980 61"
            stroke="#f59e0b"
            strokeDasharray="8 6"
            strokeWidth="3"
            fill="none"
          />
          <line x1="610" y1="25" x2="610" y2="270" stroke="#53697f" strokeDasharray="4 5" />
          <circle cx="610" cy="109" r="5" fill="#3d8bfd" stroke="#10161e" strokeWidth="2" />
          <path
            d="M610 109L680 140L750 100L825 155L915 90L980 145"
            stroke="#f59e0b"
            strokeWidth="1"
            strokeDasharray="3 7"
            opacity=".35"
            fill="none"
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
          <div className="finance-flowrows">
            {financeLiquidityFlows.map((f) => (
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
            <span className="num">{formatEur(3200)}</span>
          </div>
          <div className="finance-progress">
            <span style={{ width: '64%' }} />
          </div>
          <div className="finance-forecast-label" style={{ marginTop: 17 }}>
            <span className="small">{t('financeOpsBuffer')}</span>
            <span className="num">
              {formatEur(9000)} / {formatEur(12000)}
            </span>
          </div>
          <div className="finance-progress finance-progress--green">
            <span style={{ width: '75%' }} />
          </div>
          <p className="finance-footnote">{t('financeBufferFootnote')}</p>
        </div>
      </div>
    </div>
  )
}

/* ─── Profitability ────────────────────────────────────────── */

export function FinanceProfitability({ go }: NavProps) {
  const { t } = useI18n()
  const [mode, setMode] = useState<'customers' | 'products' | 'projects'>('customers')
  const rows = financeProfitability[mode]
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
  const bePct = (16200 / 21480) * 100

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
          <div className="finance-stat-value num">{formatEur(ov.revenue)}</div>
          <div className="finance-stat-foot">{t('financeInSelectedPeriod')}</div>
        </div>
        <div className="panel finance-stat">
          <div className="finance-stat-label">{t('financeDirectCosts')}</div>
          <div className="finance-stat-value num">
            {formatEur(financeProfitability.directCosts)}
          </div>
          <div className="finance-stat-foot">{t('financeCostsIncomplete')}</div>
        </div>
        <div className="panel finance-stat">
          <div className="finance-stat-label">{t('financeContribution')}</div>
          <div className="finance-stat-value num good">
            {formatEur(financeProfitability.contribution)}
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
                const margin = (100 * db) / revenue
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
              {formatEur(financeProfitability.breakEven)}
            </div>
            <div className="finance-section-note">{t('financeBreakEvenNote')}</div>
            <div className="finance-be-track">
              <span className="fixed" style={{ width: `${bePct}%` }} />
              <span className="surplus" style={{ width: `${100 - bePct}%` }} />
            </div>
            <div className="finance-be-labels">
              <span>
                Break-even: {formatEur(financeProfitability.breakEven)}
              </span>
              <span>
                {t('financeRevenue')}: {formatEur(ov.revenue)}
              </span>
            </div>
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

/* ─── Planning ─────────────────────────────────────────────── */

type ScenarioType = 'hire' | 'marketing' | 'subscription' | 'investment' | 'revenue'

const SCENARIO_DEFAULTS: Record<
  ScenarioType,
  { labelKey: MessageKey; value: number; monthly: boolean }
> = {
  hire: { labelKey: 'financeScenarioCostMonthly', value: 2800, monthly: true },
  marketing: { labelKey: 'financeScenarioMarketing', value: 1300, monthly: true },
  subscription: { labelKey: 'financeScenarioSub', value: 299, monthly: true },
  investment: { labelKey: 'financeScenarioOnce', value: 8500, monthly: false },
  revenue: { labelKey: 'financeScenarioExtraRev', value: 1400, monthly: true },
}

type SavedScenario = {
  type: ScenarioType
  months: number
  amount: number
}

export function FinancePlanning({ onToast }: { onToast: (msg: string) => void }) {
  const { t } = useI18n()
  const [type, setType] = useState<ScenarioType>('hire')
  const [cost, setCost] = useState(2800)
  const [start, setStart] = useState(0)
  const [months, setMonths] = useState(6)
  const [saved, setSaved] = useState<SavedScenario[]>([])

  const meta = SCENARIO_DEFAULTS[type]
  const activeMonths = Math.max(0, months - start)
  const amount =
    (meta.monthly ? activeMonths * cost : months > start ? cost : 0) *
    (type === 'revenue' ? 1 : -1)
  const base = 25920 + 8400 + Math.max(0, months - 1) * 1400
  const final = base + amount
  const percent = Math.max(0, Math.min(100, (100 * final) / base))

  const typeLabels: Record<ScenarioType, string> = {
    hire: t('financeScenarioHire'),
    marketing: t('financeScenarioMarketingAction'),
    subscription: t('financeScenarioSubAction'),
    investment: t('financeScenarioInvestAction'),
    revenue: t('financeScenarioRevAction'),
  }

  return (
    <div className="finance-screen stack">
      <div className="finance-toolbar">
        <div>
          <h2 className="finance-small-title">{t('financePlanTitle')}</h2>
          <p className="finance-pagehint">{t('financePlanHint')}</p>
        </div>
        <Tag tone="blue">{t('financeNotInActuals')}</Tag>
      </div>

      <div className="finance-plan-grid">
        <div className="panel panel-pad">
          <div className="finance-section-head">
            <div>
              <h2>{t('financeNewScenario')}</h2>
              <p>{t('financeNewScenarioHint')}</p>
            </div>
          </div>
          <div className="finance-form-group">
            <label htmlFor="finance-scenario-type">{t('financeMeasure')}</label>
            <select
              id="finance-scenario-type"
              value={type}
              onChange={(e) => {
                const next = e.target.value as ScenarioType
                setType(next)
                setCost(SCENARIO_DEFAULTS[next].value)
              }}
            >
              {(Object.keys(SCENARIO_DEFAULTS) as ScenarioType[]).map((k) => (
                <option key={k} value={k}>
                  {typeLabels[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="finance-form-grid">
            <div className="finance-form-group">
              <label htmlFor="finance-scenario-cost">{t(meta.labelKey)}</label>
              <input
                id="finance-scenario-cost"
                inputMode="decimal"
                type="number"
                min={0}
                step={100}
                value={cost}
                onChange={(e) => setCost(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div className="finance-form-group">
              <label htmlFor="finance-scenario-start">{t('financeStart')}</label>
              <select
                id="finance-scenario-start"
                value={start}
                onChange={(e) => setStart(Number(e.target.value))}
              >
                <option value={0}>{t('financeStartNow')}</option>
                <option value={1}>{t('financeStart1m')}</option>
                <option value={2}>{t('financeStart2m')}</option>
                <option value={3}>{t('financeStart3m')}</option>
              </select>
            </div>
          </div>
          <div className="finance-form-group">
            <label htmlFor="finance-scenario-months">
              {t('financeHorizonMonths')}: <strong>{months}</strong>
            </label>
            <input
              id="finance-scenario-months"
              type="range"
              min={1}
              max={12}
              step={1}
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              style={{ accentColor: 'var(--accent)' }}
            />
          </div>
          <div className="finance-infobox">
            <Info size={17} aria-hidden />
            <div>{t('financeScenarioInfo')}</div>
          </div>
        </div>

        <div className="panel panel-pad">
          <div className="finance-section-head">
            <div>
              <h2>{t('financeLiquidityImpact')}</h2>
              <p>{t('financeLiquidityImpactHint')}</p>
            </div>
          </div>
          <div className="finance-scenario-results">
            <div className="caps">{t('financeNetImpact')}</div>
            <div className={`finance-resultval num ${amount < 0 ? 'bad' : 'good'}`}>
              {amount > 0 ? '+' : ''}
              {formatEur(amount)}
            </div>
            <div className="small muted">
              {t('financeOver')} {months} {t('financeMonths')} ·{' '}
              {start === 0
                ? t('financeStartNow').toLowerCase()
                : `${t('financeAfter')} ${start} ${t('financeMonths')}`}
            </div>
            <div className="finance-faint-line" />
            <div className="finance-scenario-inline">
              <span>{t('financeBasePlan')}</span>
              <strong className="num">{formatEur(base)}</strong>
            </div>
            <div className="finance-scenario-inline">
              <span>{t('financeWithScenario')}</span>
              <strong className="num">{formatEur(final)}</strong>
            </div>
            <div className="finance-scenario-inline">
              <span>{t('financeAssessment')}</span>
              <strong className={final > 0 ? 'good' : 'bad'}>
                {final > 0 ? t('financePositiveBalance') : t('financeNegativePossible')}
              </strong>
            </div>
          </div>
          <div className="finance-section-head" style={{ marginBottom: 10 }}>
            <div>
              <h2>{t('financeBeforeAfter')}</h2>
              <p>{t('financeBeforeAfterHint')}</p>
            </div>
          </div>
          <div className="finance-progress" style={{ height: 10 }}>
            <span style={{ width: `${percent}%` }} />
          </div>
          <div className="finance-forecast-label">
            <span className="small muted">{t('financeRelativeEnd')}</span>
            <span className="small num">{Math.round(percent)} %</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22 }}>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                setSaved((prev) => [{ type, months, amount }, ...prev].slice(0, 8))
                onToast(t('financeScenarioSaved'))
              }}
            >
              <Plus size={14} weight="bold" aria-hidden />
              {t('financeSaveScenario')}
            </button>
          </div>
        </div>
      </div>

      <div className="panel panel-pad">
        <div className="finance-section-head">
          <div>
            <h2>{t('financeSavedScenarios')}</h2>
            <p>{t('financeSavedScenariosHint')}</p>
          </div>
          <button
            type="button"
            className="finance-section-link"
            onClick={() => {
              setSaved([])
              onToast(t('financeScenariosCleared'))
            }}
          >
            {t('financeReset')}
          </button>
        </div>
        {saved.length === 0 ? (
          <div className="small muted">{t('financeNoScenarios')}</div>
        ) : (
          <div className="finance-list">
            {saved.map((s, i) => (
              <div key={`${s.type}-${i}`} className="finance-listrow">
                <div>
                  <strong>{typeLabels[s.type]}</strong>
                  <div className="finance-detail">
                    {s.months} {t('financeMonths')} · {t('financeSampleCalc')}
                  </div>
                </div>
                <strong className={`num ${s.amount < 0 ? 'bad' : 'good'}`}>
                  {s.amount > 0 ? '+' : ''}
                  {formatEur(s.amount)}
                </strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Accounts & rules ─────────────────────────────────────── */

export function FinanceAccounts() {
  const { t } = useI18n()
  return (
    <div className="finance-screen stack">
      <div className="finance-toolbar">
        <div>
          <h2 className="finance-small-title">{t('financeAccountsTitle')}</h2>
          <p className="finance-pagehint">{t('financeAccountsHint')}</p>
        </div>
        <Tag>{t('financeConceptNoBank')}</Tag>
      </div>

      <div className="finance-two-column">
        <div className="panel panel-pad">
          <div className="finance-section-head">
            <div>
              <h2>{t('financeSources')}</h2>
              <p>{t('financeSourcesHint')}</p>
            </div>
          </div>
          <div className="finance-switch-row">
            <div>
              <strong>{t('financeBankCard')}</strong>
              <p>{t('financeBankCardHint')}</p>
            </div>
            <span className="finance-status-mini">{t('financeToConnect')}</span>
          </div>
          <div className="finance-switch-row">
            <div>
              <strong>{t('financeInvoices')}</strong>
              <p>{t('financeInvoicesHint')}</p>
            </div>
            <span className="finance-status-mini">{t('financeToConnect')}</span>
          </div>
          <div className="finance-switch-row">
            <div>
              <strong>{t('financeInternalLinks')}</strong>
              <p>{t('financeInternalLinksHint')}</p>
            </div>
            <Tag tone="blue">{t('financeInternalMap')}</Tag>
          </div>
          <div className="finance-switch-row">
            <div>
              <strong>{t('financeCurrencies')}</strong>
              <p>{t('financeCurrenciesHint')}</p>
            </div>
            <span className="finance-status-mini">EUR · {t('financeExample')}</span>
          </div>
        </div>

        <div className="panel panel-pad">
          <div className="finance-section-head">
            <div>
              <h2>{t('financeRulesReserves')}</h2>
              <p>{t('financeRulesHint')}</p>
            </div>
          </div>
          <div className="finance-switch-row">
            <div>
              <strong>{t('financeTaxReserve')}</strong>
              <p>{t('financeTaxReserveHint')}</p>
            </div>
            <Tag tone="amber">{t('financeManual')}</Tag>
          </div>
          <div className="finance-switch-row">
            <div>
              <strong>{t('financeOpsBuffer')}</strong>
              <p>{t('financeOpsBufferRuleHint')}</p>
            </div>
            <span className="finance-status-mini">{t('financeTarget')}</span>
          </div>
          <div className="finance-switch-row">
            <div>
              <strong>{t('financeAutoCategorize')}</strong>
              <p>{t('financeAutoCategorizeHint')}</p>
            </div>
            <Tag>{t('financePlanned')}</Tag>
          </div>
          <div className="finance-switch-row">
            <div>
              <strong>{t('financeMultiModel')}</strong>
              <p>{t('financeMultiModelHint')}</p>
            </div>
            <Tag tone="green">{t('financeUniversal')}</Tag>
          </div>
        </div>
      </div>

      <div className="finance-infobox">
        <Lightning size={17} aria-hidden />
        <div>
          <strong>{t('financeTrustPrinciple')}:</strong> {t('financeTrustBody')}
        </div>
      </div>
    </div>
  )
}
