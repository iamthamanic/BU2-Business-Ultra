/**
 * CustomFunnelToolbar — filters box (date range + export) for Email / Offline custom funnels.
 * Location: apps/web/src/features/marketing/CustomFunnelToolbar.tsx
 */
import { useState } from 'react'
import { FunnelDateRangePicker } from '../../components/FunnelDateRangePicker'
import { FunnelExportMenu } from '../../components/FunnelExportMenu'
import { useI18n } from '../../lib/i18n'
import {
  CUSTOM_PRESETS,
  dateInRange,
  defaultDateRange,
  resolveCompareRange,
  type DateRangeValue,
} from '../../lib/dateRange'
import { type FunnelExportPayload } from '../../lib/funnelExport'

export type CustomCampaignRow = {
  id: string
  name: string
  status?: string
  date?: string
  type?: string
}

type Props = {
  channel: string
  win: '24h' | '7d' | '30d' | 'all'
  onWindowChange: (w: '24h' | '7d' | '30d' | 'all') => void
  rows: CustomCampaignRow[]
}

export function CustomFunnelToolbar({ channel, win, onWindowChange, rows }: Props) {
  const { t } = useI18n()
  const [range, setRange] = useState<DateRangeValue>(() => defaultDateRange(win))

  function onRangeChange(next: DateRangeValue) {
    setRange(next)
    if (next.preset === '24h' || next.preset === '7d' || next.preset === '30d' || next.preset === 'all') {
      onWindowChange(next.preset)
    } else {
      onWindowChange('all')
    }
  }

  function getExportPayload(): FunnelExportPayload {
    const filtered =
      range.preset === 'all'
        ? rows
        : rows.filter((r) => dateInRange(r.date, range.from, range.to))
    const cmp = resolveCompareRange(range)
    const filters = [{ label: t('timeWindow'), value: `${range.from} – ${range.to}` }]
    if (cmp) filters.push({ label: t('dateCompare'), value: `${cmp.from} – ${cmp.to}` })
    return {
      kind: 'Custom',
      channel,
      from: range.from,
      to: range.to,
      filters,
      kpis: [{ label: t('kpiPosts'), value: String(filtered.length) }],
      columns: [
        { key: 'date', label: t('colDate') },
        { key: 'name', label: t('name') },
        { key: 'status', label: t('status') },
        { key: 'type', label: t('colType') },
      ],
      rows: filtered.map((r) => ({
        date: r.date || '—',
        name: r.name,
        status: r.status || '—',
        type: r.type || '—',
      })),
    }
  }

  return (
    <div className="funnel-filters-bar">
      <FunnelDateRangePicker
        value={range}
        onChange={onRangeChange}
        presets={CUSTOM_PRESETS}
        dates={rows.map((r) => r.date || '').filter(Boolean)}
      />
      <FunnelExportMenu getPayload={getExportPayload} />
    </div>
  )
}
