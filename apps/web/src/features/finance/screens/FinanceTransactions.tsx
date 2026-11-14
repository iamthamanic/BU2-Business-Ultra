/**
 * Finance transactions tab panel.
 * Location: apps/web/src/features/finance/screens/FinanceTransactions.tsx
 */
import { useMemo, useState } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { FunnelExportMenu } from '../../../components/FunnelExportMenu'
import { FunnelTip } from '../../../components/FunnelTip'
import type { MessageKey } from '../../../i18n/messages'
import { useI18n } from '../../../lib/i18n'
import type { FunnelExportPayload } from '../../../lib/funnelExport'
import { usePersistedTableColumns, type TableColumnDef } from '../../../lib/tableColumns'
import { formatEur, type FinanceTx } from '../financeModel'
import {
  FinanceConnectHint,
  statusTag,
  useFinance,
  type NavProps,
  type TxFilter,
} from './financeScreenShared'

type TxProps = NavProps & {
  filter: TxFilter
  setFilter: (f: TxFilter) => void
  onToast: (msg: string) => void
  slug: string
}

export function FinanceTransactions({
  filter,
  setFilter,
  settingsHref,
  data,
  slug,
}: TxProps) {
  const { t } = useI18n()
  const snap = useFinance(data)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<FinanceTx | null>(null)

  const cols: (TableColumnDef & { tip: MessageKey })[] = useMemo(
    () =>
      (
        [
          { key: 'date', label: t('financeColDate'), tip: 'tipFinanceDate' as const },
          { key: 'party', label: t('financeColParty'), tip: 'tipFinanceParty' as const, locked: true },
          { key: 'category', label: t('financeColCategory'), tip: 'tipFinanceCategory' as const },
          { key: 'status', label: t('financeColStatus'), tip: 'tipFinanceStatus' as const },
          { key: 'source', label: t('financeColSource'), tip: 'tipFinanceSource' as const },
          { key: 'amount', label: t('financeColAmount'), tip: 'tipFinanceAmount' as const },
        ] as const
      ).map((c) => ({ ...c, description: t(c.tip) })),
    [t],
  )

  const { visibleKeys, visibleColumns, setVisibleKeys, reset } = usePersistedTableColumns({
    slug,
    tableId: 'finance-tx',
    columns: cols,
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return snap.transactions.filter((x) => {
      if (filter === 'income' && x.kind !== 'income') return false
      if (filter === 'expense' && x.kind !== 'expense') return false
      if (filter === 'open' && !['Überfällig', 'Geplant'].includes(x.status)) return false
      if (filter === 'recurring' && !x.recurring) return false
      if (!q) return true
      return [x.name, x.category, x.project, x.desc, x.source].join(' ').toLowerCase().includes(q)
    })
  }, [filter, search, snap.transactions])

  const filters: { id: TxFilter; label: string }[] = [
    { id: 'all', label: t('financeFilterAll') },
    { id: 'income', label: t('financeFilterIncome') },
    { id: 'expense', label: t('financeFilterExpense') },
    { id: 'open', label: t('financeFilterOpen') },
    { id: 'recurring', label: t('financeFilterRecurring') },
  ]

  function getExportPayload(): FunnelExportPayload {
    const today = new Date().toISOString().slice(0, 10)
    const filterLabel = filters.find((f) => f.id === filter)?.label || t('financeFilterAll')
    return {
      kind: 'Custom',
      channel: 'finance',
      from: today,
      to: today,
      filters: [
        { label: t('financeFilterStatus'), value: filterLabel },
        ...(search.trim()
          ? [{ label: t('financeSearchTx'), value: search.trim() }]
          : []),
      ],
      kpis: [
        {
          label: t('financeEntries'),
          value: `${filtered.length} / ${snap.transactions.length}`,
        },
      ],
      columns: cols.map((c) => ({ key: c.key, label: c.label })),
      rows: filtered.map((x) => ({
        date: x.date,
        party: x.name,
        category: `${x.category}${x.project ? ` · ${x.project}` : ''}`,
        status: x.status,
        source: x.source,
        amount: formatEur(x.amount),
      })),
    }
  }

  const openIncome = snap.transactions
    .filter((x) => x.kind === 'income' && x.status !== 'Bezahlt')
    .reduce((s, x) => s + x.amount, 0)
  const plannedOut = Math.abs(
    snap.transactions
      .filter((x) => x.kind === 'expense' && x.status === 'Geplant')
      .reduce((s, x) => s + x.amount, 0),
  )

  return (
    <div className="finance-screen stack">
      <div className="finance-toolbar">
        <div>
          <h2 className="finance-small-title">{t('financeAllMovements')}</h2>
          <p className="finance-pagehint">{t('financeAllMovementsHint')}</p>
        </div>
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
          <div className="finance-toolbar-end">
            <div className="finance-searchbox">
              <MagnifyingGlass size={14} aria-hidden />
              <input
                aria-label={t('financeSearchTx')}
                placeholder={t('financeSearchTxPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <FunnelExportMenu
              getPayload={getExportPayload}
              columnPicker={{
                columns: cols,
                visibleKeys,
                onChange: setVisibleKeys,
                onReset: reset,
              }}
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="finance-tablewrap">
          <table className="finance-data-table">
            <thead>
              <tr>
                {visibleColumns.map((col) => {
                  const tip = cols.find((c) => c.key === col.key)?.tip
                  return (
                    <th key={col.key}>
                      <span>{col.label}</span>
                      {tip ? (
                        <FunnelTip tip={t(tip)} iconOnly>
                          {col.label}
                        </FunnelTip>
                      ) : null}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={Math.max(visibleColumns.length, 1)}
                    className={
                      snap.transactions.length === 0
                        ? 'finance-empty funnel-table-empty'
                        : 'finance-empty'
                    }
                  >
                    {snap.transactions.length === 0 ? (
                      <FinanceConnectHint settingsHref={settingsHref} />
                    ) : (
                      <>
                        <strong>{t('financeTxEmpty')}</strong>
                        {t('financeTxEmptyHint')}
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((x) => (
                  <tr key={x.id} onClick={() => setSelected(x)}>
                    {visibleColumns.map((col) => {
                      if (col.key === 'date') {
                        return (
                          <td key={col.key} className="mono">
                            {x.date}
                          </td>
                        )
                      }
                      if (col.key === 'party') {
                        return (
                          <td key={col.key}>
                            <strong>{x.name}</strong>
                            <div className="tiny muted" style={{ marginTop: 3 }}>
                              {x.desc}
                            </div>
                          </td>
                        )
                      }
                      if (col.key === 'category') {
                        return (
                          <td key={col.key}>
                            {x.category}
                            <div className="tiny dim" style={{ marginTop: 3 }}>
                              {x.project}
                            </div>
                          </td>
                        )
                      }
                      if (col.key === 'status') {
                        return <td key={col.key}>{statusTag(x.status)}</td>
                      }
                      if (col.key === 'source') {
                        return <td key={col.key}>{x.source}</td>
                      }
                      if (col.key === 'amount') {
                        return (
                          <td key={col.key} className={`finance-amount ${x.amount > 0 ? 'in' : 'out'}`}>
                            {x.amount > 0 ? '+' : ''}
                            {formatEur(x.amount)}
                          </td>
                        )
                      }
                      return <td key={col.key}>—</td>
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="finance-tablefooter">
          <span>
            {filtered.length} {t('financeOf')} {snap.transactions.length} {t('financeEntries')}
          </span>
          <span>{t('financeAmountsNoteLive')}</span>
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
          {snap.transactions.length === 0 ? (
            <FinanceConnectHint settingsHref={settingsHref} />
          ) : (
            <div className="finance-metric-flex">
              <div>
                <div className="caps">{t('financeOpenIncome')}</div>
                <div className="finance-boldnumber num" style={{ marginTop: 6 }}>
                  {formatEur(openIncome)}
                </div>
              </div>
              <div>
                <div className="caps">{t('financePlannedExpenses')}</div>
                <div className="finance-boldnumber num" style={{ marginTop: 6 }}>
                  {formatEur(plannedOut)}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="panel panel-pad">
          <div className="finance-section-head">
            <div>
              <h2>{t('financeRecurringExpenses')}</h2>
              <p>{t('financeRecurringHint')}</p>
            </div>
          </div>
          {snap.recurring.length === 0 ? (
            <FinanceConnectHint settingsHref={settingsHref} />
          ) : (
            <div className="finance-list">
              {snap.recurring.map((r) => (
                <div key={r.name} className="finance-listrow">
                  <div>
                    <strong>{r.name}</strong>
                    <div className="finance-detail">{r.detail}</div>
                  </div>
                  <strong className="num">{formatEur(r.amount)}</strong>
                </div>
              ))}
            </div>
          )}
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
          <div className="bu-modal panel crm-modal" onClick={(e) => e.stopPropagation()}>
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
