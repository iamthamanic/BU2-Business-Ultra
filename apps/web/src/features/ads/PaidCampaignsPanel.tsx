/**
 * PaidCampaignsPanel — Legacy-parity Paid funnel chrome (KPI strip + campaigns table).
 * Always renders full structure; empty body when no rows / not connected.
 * Location: apps/web/src/features/ads/PaidCampaignsPanel.tsx
 */
import { useMemo, useState } from 'react'
import type { Icon } from '@phosphor-icons/react'
import {
  ChartLineUp,
  Coin,
  CurrencyEur,
  CursorClick,
  Eye,
  Percent,
  Tag,
  Target,
  TrendUp,
  Wallet,
} from '@phosphor-icons/react'
import { FunnelTip } from '../../components/FunnelTip'
import { useI18n } from '../../lib/i18n'
import type { MessageKey } from '../../i18n/messages'

export type PaidCampaignRow = {
  id: string
  name: string
  notesCount?: number
  adsConv?: number | null
  manualConv?: number | null
  spendCents?: number | null
  impressions?: number | null
  clicks?: number | null
  ctr?: number | null
  cpcCents?: number | null
  cvr?: number | null
  cpaCents?: number | null
  roas?: number | null
  revenueCents?: number | null
  status?: string
}

type WindowKey = '7d' | '30d' | '90d' | 'all'

const WINDOWS: { key: WindowKey; labelKey: 'win7d' | 'win30d' | 'win90d' | 'winAll' }[] = [
  { key: '7d', labelKey: 'win7d' },
  { key: '30d', labelKey: 'win30d' },
  { key: '90d', labelKey: 'win90d' },
  { key: 'all', labelKey: 'winAll' },
]

type Props = {
  campaigns: PaidCampaignRow[]
  emptyHint: string
  initialWindow?: WindowKey
  onWindowChange?: (w: WindowKey) => void
}

export function PaidCampaignsPanel({
  campaigns,
  emptyHint,
  initialWindow = '30d',
  onWindowChange,
}: Props) {
  const { t } = useI18n()
  const [win, setWin] = useState<WindowKey>(initialWindow)
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return campaigns
    return campaigns.filter((c) => c.name.toLowerCase().includes(needle))
  }, [campaigns, q])

  const agg = useMemo(() => sumCampaigns(filtered), [filtered])

  function pickWindow(w: WindowKey) {
    setWin(w)
    onWindowChange?.(w)
  }

  const cols: { key: string; label: string; tip: MessageKey }[] = [
    { key: 'notes', label: t('colNotes'), tip: 'tipNotes' },
    { key: 'manual', label: t('colManualAds'), tip: 'tipManualAds' },
    { key: 'name', label: t('colCampaign'), tip: 'tipCampaign' },
    { key: 'spend', label: t('colSpend'), tip: 'tipSpend' },
    { key: 'impr', label: t('colImpr'), tip: 'tipImpr' },
    { key: 'clicks', label: t('colClicks'), tip: 'tipClicks' },
    { key: 'ctr', label: t('colCtr'), tip: 'tipCtr' },
    { key: 'cpc', label: t('colCpc'), tip: 'tipCpc' },
    { key: 'cvr', label: t('colCvr'), tip: 'tipCvr' },
    { key: 'cpa', label: t('colCpa'), tip: 'tipCpa' },
    { key: 'roas', label: t('colRoas'), tip: 'tipRoas' },
    { key: 'revenue', label: t('colRevenue'), tip: 'tipRevenue' },
  ]

  return (
    <div className="stack paid-campaigns-panel">
      <div className="funnel-filter-row paid-filter-row" role="toolbar" aria-label={t('timeWindow')}>
        <FunnelTip tip={t('tipWin')} as="span" className="filter-lbl muted">
          {t('timeWindow')}
        </FunnelTip>
        {WINDOWS.map((w) => (
          <button
            key={w.key}
            type="button"
            className={`chip ${win === w.key ? 'active' : ''}`}
            onClick={() => pickWindow(w.key)}
          >
            {t(w.labelKey)}
            <span className="n">{w.key === win ? filtered.length : '·'}</span>
          </button>
        ))}
        <label className="paid-search">
          <span className="sr-only">{t('adsSearchPh')}</span>
          <input
            className="input paid-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('adsSearchPh')}
          />
        </label>
      </div>

      <div className="funnel-kpi-strip paid-kpi-strip" aria-label="KPIs">
        <Kpi icon={CurrencyEur} label={t('colSpend')} value={fmtEur(agg.spendCents)} tip={t('tipSpend')} accent />
        <Kpi icon={Eye} label={t('colImpr')} value={fmtN(agg.impressions)} tip={t('tipImpr')} />
        <Kpi icon={CursorClick} label={t('colClicks')} value={fmtN(agg.clicks)} tip={t('tipClicks')} />
        <Kpi icon={ChartLineUp} label={t('colCtr')} value={fmtPct(agg.ctr)} tip={t('tipCtr')} />
        <Kpi icon={Coin} label={t('colCpc')} value={fmtEur(agg.cpcCents)} tip={t('tipCpc')} />
        <Kpi icon={Target} label={t('colConv')} value={fmtN(agg.conv)} tip={t('tipConv')} />
        <Kpi icon={Percent} label={t('colCvr')} value={fmtPct(agg.cvr)} tip={t('tipCvr')} />
        <Kpi icon={Tag} label={t('colCpa')} value={fmtEur(agg.cpaCents)} tip={t('tipCpa')} />
        <Kpi icon={TrendUp} label={t('colRoas')} value={fmtRoas(agg.roas)} tip={t('tipRoas')} accent />
        <Kpi icon={Wallet} label={t('colRevenue')} value={fmtEur(agg.revenueCents)} tip={t('tipRevenue')} />
      </div>

      <div className="panel funnel-table-wrap">
        <table className="table funnel-ads-table">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key}>
                  <FunnelTip tip={t(c.tip)}>{c.label}</FunnelTip>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={cols.length} className="funnel-table-empty muted">
                  {emptyHint}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="badge">{t('notesBadge').replace('{n}', String(c.notesCount ?? 0))}</span>
                  </td>
                  <td className="num">
                    <div className="paid-manual-cell">
                      <span className="muted">{t('adsConvShort')}</span>
                      <strong>{c.adsConv != null ? fmtN(c.adsConv) : '—'}</strong>
                      <span className="muted paid-manual-dash">—</span>
                    </div>
                  </td>
                  <td>
                    <div className="paid-camp-name">{c.name}</div>
                    {c.status ? <span className="badge">{c.status}</span> : null}
                  </td>
                  <td className="num">{fmtEur(c.spendCents ?? 0)}</td>
                  <td className="num">{fmtN(c.impressions ?? 0)}</td>
                  <td className="num">{fmtN(c.clicks ?? 0)}</td>
                  <td className="num">{fmtPct(c.ctr)}</td>
                  <td className="num">{fmtEur(c.cpcCents)}</td>
                  <td className="num">{fmtPct(c.cvr)}</td>
                  <td className="num">{fmtEur(c.cpaCents)}</td>
                  <td className="num">{fmtRoas(c.roas)}</td>
                  <td className="num">{fmtEur(c.revenueCents ?? 0)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Kpi({
  icon: Ic,
  label,
  value,
  tip,
  accent,
}: {
  icon: Icon
  label: string
  value: string
  tip: string
  accent?: boolean
}) {
  return (
    <FunnelTip tip={tip} as="div" className={`funnel-kpi${accent ? ' funnel-kpi--accent' : ''}`}>
      <div className="funnel-kpi-head">
        <span className="funnel-kpi-ic" aria-hidden>
          <Ic size={16} weight="duotone" />
        </span>
        <div className="funnel-kpi-l muted">{label}</div>
      </div>
      <div className="funnel-kpi-v">{value}</div>
    </FunnelTip>
  )
}

function sumCampaigns(rows: PaidCampaignRow[]) {
  const spendCents = rows.reduce((s, r) => s + (r.spendCents || 0), 0)
  const impressions = rows.reduce((s, r) => s + (r.impressions || 0), 0)
  const clicks = rows.reduce((s, r) => s + (r.clicks || 0), 0)
  const conv = rows.reduce((s, r) => s + (r.adsConv || 0), 0)
  const revenueCents = rows.reduce((s, r) => s + (r.revenueCents || 0), 0)
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : null
  const cpcCents = clicks > 0 ? Math.round(spendCents / clicks) : null
  const cvr = clicks > 0 ? (conv / clicks) * 100 : null
  const cpaCents = conv > 0 ? Math.round(spendCents / conv) : null
  const roas = spendCents > 0 ? revenueCents / spendCents : null
  return { spendCents, impressions, clicks, ctr, cpcCents, conv, cvr, cpaCents, roas, revenueCents }
}

function fmtN(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—'
  return Math.round(n).toLocaleString('de-DE')
}

function fmtEur(cents: number | null | undefined) {
  if (cents == null || !Number.isFinite(cents)) return '—'
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function fmtPct(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n.toFixed(2)} %`
}

function fmtRoas(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n.toFixed(2)}×`
}
