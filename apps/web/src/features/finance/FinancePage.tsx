/**
 * FinancePage — Dark-Ops finance hub (empty until connectors supply data).
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
import { MktTab, MktTabs } from '../../components/MktTabs'
import { companyRoutes } from '../../lib/companyPaths'
import { useI18n } from '../../lib/i18n'
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
  const [period, setPeriod] = useState('current')
  const [toast, setToast] = useState<string | null>(null)
  const settingsHref = slug ? companyRoutes(slug).settingsConnections : '#'

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 3300)
    return () => window.clearTimeout(id)
  }, [toast])

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
          <button type="button" className="btn" onClick={() => go('settings')}>
            {t('financeDataOrigin')}
          </button>
          <select
            className="select"
            aria-label={t('financePeriod')}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="current">{t('financePeriodCurrent')}</option>
            <option value="prev">{t('financePeriodPrev')}</option>
            <option value="90d">{t('financeLast90')}</option>
          </select>
        </div>
      </header>

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
        <FinanceOverview go={go} settingsHref={settingsHref} />
      ) : null}
      {screen === 'transactions' ? (
        <FinanceTransactions
          go={go}
          settingsHref={settingsHref}
          filter={txFilter}
          setFilter={setTxFilter}
          onToast={showToast}
        />
      ) : null}
      {screen === 'analysis' ? <FinanceAnalysis settingsHref={settingsHref} /> : null}
      {screen === 'liquidity' ? (
        <FinanceLiquidity go={go} settingsHref={settingsHref} />
      ) : null}
      {screen === 'profitability' ? (
        <FinanceProfitability go={go} settingsHref={settingsHref} />
      ) : null}
      {screen === 'planning' ? (
        <FinancePlanning onToast={showToast} settingsHref={settingsHref} />
      ) : null}
      {screen === 'settings' ? <FinanceAccounts settingsHref={settingsHref} /> : null}

      <p className="finance-footnote finance-page-footnote">{t('financeDisclaimerLive')}</p>

      {toast ? (
        <div className="finance-toaster" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}
    </div>
  )
}
