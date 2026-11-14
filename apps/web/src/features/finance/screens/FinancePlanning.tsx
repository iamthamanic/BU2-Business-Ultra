/**
 * Finance planning / scenario tab panel.
 * Location: apps/web/src/features/finance/screens/FinancePlanning.tsx
 */
import { useState } from 'react'
import {
  Info,
  Plus,
} from '@phosphor-icons/react'
import type { MessageKey } from '../../../i18n/messages'
import { useI18n } from '../../../lib/i18n'
import { formatEur, formatEurOrDash, type FinanceSnapshot } from '../financeModel'
import { FinanceConnectHint, Tag, useFinance } from './financeScreenShared'

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

export function FinancePlanning({
  onToast,
  settingsHref,
  data,
}: {
  onToast: (msg: string) => void
  settingsHref: string
  data?: FinanceSnapshot
}) {
  const { t } = useI18n()
  const snap = useFinance(data)
  const needsConnect = snap.balance === null
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
  const base =
    snap.planningBaseBalance +
    (snap.liquidityOutlook ?? 0) +
    Math.max(0, months - 1) * snap.planningMonthlyDrift
  const final = base + amount
  const percent = base === 0 ? (final === 0 ? 0 : 100) : Math.max(0, Math.min(100, (100 * final) / Math.abs(base || 1)))

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
          <p className="finance-pagehint">{t('financePlanHintEmpty')}</p>
        </div>
        <Tag tone="blue">{t('financeNotInActuals')}</Tag>
      </div>

      {needsConnect ? <FinanceConnectHint settingsHref={settingsHref} /> : null}

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
                    {s.months} {t('financeMonths')}
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

