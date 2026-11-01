/**
 * CustomFunnelToolbar — single filters box (Zeitraum + export) for Email / Offline custom funnels.
 * Location: apps/web/src/features/marketing/CustomFunnelToolbar.tsx
 */
import { Clock } from '@phosphor-icons/react'
import { FunnelExportMenu } from '../../components/FunnelExportMenu'
import { FunnelTip } from '../../components/FunnelTip'
import { useI18n } from '../../lib/i18n'
import {
  windowToDateRange,
  type FunnelExportPayload,
} from '../../lib/funnelExport'

type WindowKey = '24h' | '7d' | '30d' | 'all'

const WINDOWS: { key: WindowKey; labelKey: 'win24h' | 'win7d' | 'win30d' | 'winAll' }[] = [
  { key: '24h', labelKey: 'win24h' },
  { key: '7d', labelKey: 'win7d' },
  { key: '30d', labelKey: 'win30d' },
  { key: 'all', labelKey: 'winAll' },
]

export type CustomCampaignRow = {
  id: string
  name: string
  status?: string
  date?: string
  type?: string
}

type Props = {
  channel: string
  win: WindowKey
  onWindowChange: (w: WindowKey) => void
  rows: CustomCampaignRow[]
}

export function CustomFunnelToolbar({ channel, win, onWindowChange, rows }: Props) {
  const { t } = useI18n()

  function getExportPayload(): FunnelExportPayload {
    const range = windowToDateRange(win, { dates: rows.map((r) => r.date || '').filter(Boolean) })
    const winLabel = WINDOWS.find((w) => w.key === win)
    return {
      kind: 'Custom',
      channel,
      from: range.from,
      to: range.to,
      filters: [{ label: t('timeWindow'), value: winLabel ? t(winLabel.labelKey) : win }],
      kpis: [{ label: t('kpiPosts'), value: String(rows.length) }],
      columns: [
        { key: 'date', label: t('colDate') },
        { key: 'name', label: t('name') },
        { key: 'status', label: t('status') },
        { key: 'type', label: t('colType') },
      ],
      rows: rows.map((r) => ({
        date: r.date || '—',
        name: r.name,
        status: r.status || '—',
        type: r.type || '—',
      })),
    }
  }

  return (
    <div className="funnel-filters-bar">
      <div className="funnel-filter-row" role="toolbar" aria-label={t('timeWindow')}>
        <span className="filter-lbl muted">
          <Clock className="filter-lbl-ic" size={14} weight="duotone" aria-hidden />
          <FunnelTip tip={t('tipWin')}>{t('timeWindow')}</FunnelTip>
        </span>
        {WINDOWS.map((w) => (
          <button
            key={w.key}
            type="button"
            className={`chip ${win === w.key ? 'active' : ''}`}
            onClick={() => onWindowChange(w.key)}
          >
            {t(w.labelKey)}
            <span className="n">{w.key === win ? rows.length : '·'}</span>
          </button>
        ))}
      </div>
      <FunnelExportMenu getPayload={getExportPayload} />
    </div>
  )
}
