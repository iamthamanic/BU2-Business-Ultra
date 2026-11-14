/**
 * FinancePage — Dark-Ops finance hub backed by `/finance/snapshot`.
 * Location: apps/web/src/features/finance/FinancePage.tsx
 */
import { useEffect, useState } from 'react'
import {
  ArrowsLeftRight,
  ChartBar,
  ChartLineUp,
  Clock,
  GearSix,
  SquaresFour,
  TrendUp,
} from '@phosphor-icons/react'
import { useParams } from 'react-router-dom'
import type { FinancePeriod } from '@bu2/shared'
import { MktTab, MktTabs } from '../../components/MktTabs'
import { api } from '../../lib/api'
import { companyRoutes } from '../../lib/companyPaths'
import { useI18n } from '../../lib/i18n'
import { EMPTY_FINANCE, type FinanceSnapshot } from './financeModel'
import {
  FinanceAccounts,
  FinanceAnalysis,
  FinanceLiquidity,
  FinanceOverview,
  FinancePlanning,
  FinanceProfitability,
  FinanceTransactions,
  type FinanceScreen,
  type TxFilter,
} from './FinanceScreens'

const TAB_META: {
  id: FinanceScreen
  labelKey:
    | 'financeTabOverview'
    | 'financeTabTransactions'
    | 'financeTabAnalysis'
    | 'financeTabLiquidity'
    | 'financeTabProfitability'
    | 'financeTabPlanning'
    | 'financeTabAccounts'
  icon: typeof SquaresFour
}[] = [
  { id: 'overview', labelKey: 'financeTabOverview', icon: SquaresFour },
  { id: 'transactions', labelKey: 'financeTabTransactions', icon: ArrowsLeftRight },
  { id: 'analysis', labelKey: 'financeTabAnalysis', icon: ChartLineUp },
  { id: 'liquidity', labelKey: 'financeTabLiquidity', icon: Clock },
  { id: 'profitability', labelKey: 'financeTabProfitability', icon: ChartBar },
  { id: 'planning', labelKey: 'financeTabPlanning', icon: TrendUp },
  { id: 'settings', labelKey: 'financeTabAccounts', icon: GearSix },
]

export function FinancePage() {
  const { slug } = useParams()
  const { t } = useI18n()
  const [screen, setScreen] = useState<FinanceScreen>('overview')
  const [txFilter, setTxFilter] = useState<TxFilter>('all')
  const [period, setPeriod] = useState<FinancePeriod>('current')
  const [data, setData] = useState<FinanceSnapshot>(EMPTY_FINANCE)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const settingsHref = slug ? companyRoutes(slug).settingsFinanceConnections : '#'

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 3300)
    return () => window.clearTimeout(id)
  }, [toast])

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    api<{ snapshot: FinanceSnapshot }>(`/api/b/${slug}/finance/snapshot?period=${period}`)
      .then((res) => {
        if (cancelled) return
        setData(res.snapshot)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setData(EMPTY_FINANCE)
        setLoadError(err instanceof Error ? err.message : 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug, period])

  function go(next: FinanceScreen, opts?: { txFilter?: TxFilter }) {
    if (opts?.txFilter) setTxFilter(opts.txFilter)
    setScreen(next)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  function showToast(msg: string) {
    setToast(msg)
  }

  const contextLabel = t(TAB_META.find((x) => x.id === screen)?.labelKey ?? 'financeTabOverview')

  return (
    <div className="stack mkt-shell product-shell crm-shell finance-shell">
      <header className="product-page-head finance-page-head">
        <div>
          <h1 className="section-title product-page-title">
            {t('finance')}{' '}
            <span className="finance-screen-tag">{contextLabel}</span>
          </h1>
          <p className="muted finance-page-sub">{t('financeLedeLive')}</p>
        </div>
        <div className="finance-head-actions">
          <select
            className="select"
            aria-label={t('financePeriod')}
            value={period}
            onChange={(e) => setPeriod(e.target.value as FinancePeriod)}
          >
            <option value="current">{t('financePeriodCurrent')}</option>
            <option value="prev">{t('financePeriodPrev')}</option>
            <option value="90d">{t('financeLast90')}</option>
          </select>
        </div>
      </header>

      {loadError ? (
        <p className="muted" role="alert">
          {t('financeLoadError')}: {loadError}
        </p>
      ) : null}
      {loading ? <p className="muted">{t('loading')}</p> : null}

      <MktTabs level="surface" label={t('finance')} className="finance-tabs">
        {TAB_META.map((tab) => (
          <MktTab
            key={tab.id}
            active={screen === tab.id}
            label={t(tab.labelKey)}
            onClick={() => go(tab.id)}
            icon={tab.icon}
            dataIc="finance"
          />
        ))}
      </MktTabs>

      {screen === 'overview' ? (
        <FinanceOverview go={go} settingsHref={settingsHref} data={data} />
      ) : null}
      {screen === 'transactions' ? (
        <FinanceTransactions
          go={go}
          settingsHref={settingsHref}
          filter={txFilter}
          setFilter={setTxFilter}
          onToast={showToast}
          data={data}
          slug={slug || ''}
        />
      ) : null}
      {screen === 'analysis' ? (
        <FinanceAnalysis settingsHref={settingsHref} data={data} />
      ) : null}
      {screen === 'liquidity' ? (
        <FinanceLiquidity go={go} settingsHref={settingsHref} data={data} />
      ) : null}
      {screen === 'profitability' ? (
        <FinanceProfitability go={go} settingsHref={settingsHref} data={data} />
      ) : null}
      {screen === 'planning' ? (
        <FinancePlanning onToast={showToast} settingsHref={settingsHref} data={data} />
      ) : null}
      {screen === 'settings' ? (
        <FinanceAccounts settingsHref={settingsHref} data={data} />
      ) : null}

      <p className="finance-footnote finance-page-footnote">{t('financeDisclaimerLive')}</p>

      {toast ? (
        <div className="finance-toaster" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}
    </div>
  )
}
