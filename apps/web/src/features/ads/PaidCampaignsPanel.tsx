/**
 * PaidCampaignsPanel — Legacy-parity Paid funnel chrome (KPI strip + campaigns table).
 * Always renders full structure; empty body when no rows / not connected.
 * Location: apps/web/src/features/ads/PaidCampaignsPanel.tsx
 */
import { useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n'

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

  const cols = [
    { key: 'notes', label: t('colNotes') },
    { key: 'manual', label: t('colManualAds') },
    { key: 'name', label: t('colCampaign') },
    { key: 'spend', label: t('colSpend') },
    { key: 'impr', label: t('colImpr') },
    { key: 'clicks', label: t('colClicks') },
    { key: 'ctr', label: t('colCtr') },
    { key: 'cpc', label: t('colCpc') },
    { key: 'cvr', label: t('colCvr') },
    { key: 'cpa', label: t('colCpa') },
    { key: 'roas', label: t('colRoas') },
    { key: 'revenue', label: t('colRevenue') },
  ] as const

  return (
    <div className="stack paid-campaigns-panel">
      <div className="funnel-filter-row paid-filter-row" role="toolbar" aria-label={t('timeWindow')}>
        <span className="filter-lbl muted">{t('timeWindow')}</span>
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
        <Kpi label={t('colSpend')} value={fmtEur(agg.spendCents)} accent />
        <Kpi label={t('colImpr')} value={fmtN(agg.impressions)} />
        <Kpi label={t('colClicks')} value={fmtN(agg.clicks)} />
        <Kpi label={t('colCtr')} value={fmtPct(agg.ctr)} />
        <Kpi label={t('colCpc')} value={fmtEur(agg.cpcCents)} />
        <Kpi label={t('colConv')} value={fmtN(agg.conv)} />
        <Kpi label={t('colCvr')} value={fmtPct(agg.cvr)} />
        <Kpi label={t('colCpa')} value={fmtEur(agg.cpaCents)} />
        <Kpi label={t('colRoas')} value={fmtRoas(agg.roas)} accent />
        <Kpi label={t('colRevenue')} value={fmtEur(agg.revenueCents)} />
      </div>

      <div className="panel funnel-table-wrap">
        <table className="table funnel-ads-table">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key}>{c.label}</th>
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

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`funnel-kpi${accent ? ' funnel-kpi--accent' : ''}`}>
      <div className="funnel-kpi-l muted">{label}</div>
      <div className="funnel-kpi-v">{value}</div>
    </div>
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
