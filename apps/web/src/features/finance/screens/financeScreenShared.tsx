/**
 * Shared finance screen primitives.
 * Location: apps/web/src/features/finance/screens/financeScreenShared.tsx
 */
import { type ReactNode } from 'react'
import { useI18n } from '../../../lib/i18n'
import { FunnelConnectHint } from '../../marketing/FunnelConnectHint'
import {
  EMPTY_FINANCE,
  type FinanceSnapshot,
  type FinanceTx,
} from '../financeModel'

export type FinanceScreen =
  | 'overview'
  | 'transactions'
  | 'analysis'
  | 'liquidity'
  | 'profitability'
  | 'planning'
  | 'settings'

export type TxFilter = 'all' | 'income' | 'expense' | 'open' | 'recurring'

export type NavProps = {
  go: (screen: FinanceScreen, opts?: { txFilter?: TxFilter }) => void
  settingsHref: string
  data?: FinanceSnapshot
}

export function useFinance(data?: FinanceSnapshot): FinanceSnapshot {
  return data ?? EMPTY_FINANCE
}

export function Tag({
  children,
  tone,
}: {
  children: ReactNode
  tone?: 'green' | 'amber' | 'red' | 'blue' | 'neutral'
}) {
  const cls = tone && tone !== 'neutral' ? ` finance-tag--${tone}` : ''
  return <span className={`finance-tag${cls}`}>{children}</span>
}

/** Same chrome as Marketing/Inbox empty connect banner. */
export function FinanceConnectHint({ settingsHref }: { settingsHref: string }) {
  const { t } = useI18n()
  return (
    <FunnelConnectHint
      need="connection"
      settingsHref={settingsHref}
      message={t('financeConnectBanner')}
    />
  )
}

export function EmptyFilterBlock({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="finance-empty-block">
      <strong>{title}</strong>
      <span>{hint}</span>
    </div>
  )
}

export function statusTag(status: FinanceTx['status']) {
  const tone = status === 'Bezahlt' ? 'green' : status === 'Geplant' ? 'blue' : 'red'
  return <Tag tone={tone}>{status}</Tag>
}
