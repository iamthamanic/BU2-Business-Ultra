/**
 * OrganicPostsPanel — Legacy-parity posts table + window chips for organic funnel channels.
 * Columns mirror Legacy dashboard COLS (reach only for Meta). Location: apps/web/src/features/marketing/OrganicPostsPanel.tsx
 */
import { useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n'

export type OrganicPost = {
  id: string
  date: string
  type: string
  bucket: string
  title: string
  url: string | null
  image: string | null
  views: number
  reach: number | null
  likes: number
  comments: number
  shares: number
  saves: number
  engagement: number | null
  durationSec: number | null
  watchPct: number | null
  paidShare: number | null
  sharesPer1000: number | null
  savesPer1000: number | null
  savesPer100: number | null
  kpiHit: boolean | null
}

type WindowKey = '24h' | '7d' | '30d' | 'all'

const WINDOWS: { key: WindowKey; labelKey: 'win24h' | 'win7d' | 'win30d' | 'winAll' }[] = [
  { key: '24h', labelKey: 'win24h' },
  { key: '7d', labelKey: 'win7d' },
  { key: '30d', labelKey: 'win30d' },
  { key: 'all', labelKey: 'winAll' },
]

const META = new Set(['instagram', 'facebook'])

type Props = {
  channel: string
  posts: OrganicPost[]
  emptyHint: string
  initialWindow?: WindowKey
  onWindowChange?: (w: WindowKey) => void
}

export function OrganicPostsPanel({
  channel,
  posts,
  emptyHint,
  initialWindow = '30d',
  onWindowChange,
}: Props) {
  const { t } = useI18n()
  const [win, setWin] = useState<WindowKey>(initialWindow)
  const showReach = META.has(channel)

  const cols = useMemo(() => {
    const base: { key: string; label: string }[] = [
      { key: 'thumb', label: '' },
      { key: 'date', label: t('colDate') },
      { key: 'type', label: t('colType') },
      { key: 'bucket', label: t('colAge') },
      { key: 'title', label: t('colPost') },
      { key: 'views', label: t('colViews') },
    ]
    if (showReach) base.push({ key: 'reach', label: t('colReach') })
    base.push(
      { key: 'shareRate', label: showReach ? t('colShareRate') : t('colShPer1k') },
      { key: 'saveRate', label: showReach ? t('colSaveRate') : t('colSaPer100') },
      { key: 'watch', label: t('colWatch') },
      { key: 'duration', label: t('colDuration') },
      { key: 'paid', label: t('colPaidShare') },
      { key: 'likes', label: t('colLikes') },
      { key: 'comments', label: t('colComments') },
      { key: 'shares', label: t('colShares') },
      { key: 'saves', label: t('colSaves') },
      { key: 'er', label: t('colEr') },
      { key: 'kpi', label: t('colKpi') },
    )
    return base
  }, [showReach, t])

  function pickWindow(w: WindowKey) {
    setWin(w)
    onWindowChange?.(w)
  }

  const kpis = useMemo(() => {
    const views = posts.reduce((s, p) => s + (p.views || 0), 0)
    const reach = posts.reduce((s, p) => s + (p.reach || 0), 0)
    const likes = posts.reduce((s, p) => s + (p.likes || 0), 0)
    const inter = posts.reduce(
      (s, p) => s + (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0),
      0,
    )
    return { posts: posts.length, views, reach, inter, likes }
  }, [posts])

  return (
    <div className="stack organic-posts-panel">
      <div className="funnel-filter-row" role="toolbar" aria-label={t('colDate')}>
        <span className="filter-lbl muted">{t('timeWindow')}</span>
        {WINDOWS.map((w) => (
          <button
            key={w.key}
            type="button"
            className={`chip ${win === w.key ? 'active' : ''}`}
            onClick={() => pickWindow(w.key)}
          >
            {t(w.labelKey)}
            <span className="n">{w.key === win ? posts.length : '·'}</span>
          </button>
        ))}
      </div>

      <div className="funnel-kpi-strip" aria-label="KPIs">
        <Kpi label={t('kpiPosts')} value={fmtN(kpis.posts)} />
        <Kpi label={t('colViews')} value={fmtN(kpis.views)} />
        {showReach ? <Kpi label={t('colReach')} value={fmtN(kpis.reach)} /> : null}
        <Kpi label={t('kpiInteractions')} value={fmtN(kpis.inter)} />
        <Kpi label={t('colLikes')} value={fmtN(kpis.likes)} />
      </div>

      <div className="panel funnel-table-wrap">
        <table className="table funnel-posts-table">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? (
              <tr>
                <td colSpan={cols.length} className="funnel-table-empty muted">
                  {emptyHint}
                </td>
              </tr>
            ) : (
              posts.map((p) => (
                <tr key={p.id}>
                  <td className="funnel-thumb-cell">
                    {p.image ? (
                      <a href={p.url || '#'} target="_blank" rel="noopener noreferrer">
                        <img className="funnel-thumb" src={p.image} alt="" loading="lazy" />
                      </a>
                    ) : null}
                  </td>
                  <td className="num">{fmtDate(p.date)}</td>
                  <td>
                    <span className="badge">{p.type}</span>
                  </td>
                  <td>
                    <span className="badge">{bucketLabel(p.bucket)}</span>
                  </td>
                  <td>
                    {p.url ? (
                      <a href={p.url} target="_blank" rel="noopener noreferrer">
                        {p.title || '—'}
                      </a>
                    ) : (
                      p.title || '—'
                    )}
                  </td>
                  <td className="num">{fmtN(p.views)}</td>
                  {showReach ? <td className="num">{p.reach != null ? fmtN(p.reach) : '—'}</td> : null}
                  <td className="num">
                    {showReach
                      ? p.sharesPer1000 != null
                        ? String(p.sharesPer1000)
                        : '—'
                      : p.sharesPer1000 != null
                        ? String(p.sharesPer1000)
                        : '—'}
                  </td>
                  <td className="num">
                    {showReach
                      ? p.savesPer1000 != null
                        ? String(p.savesPer1000)
                        : '—'
                      : p.savesPer100 != null
                        ? String(p.savesPer100)
                        : '—'}
                  </td>
                  <td className="num">{p.watchPct != null ? `${p.watchPct}%` : '—'}</td>
                  <td className="num">{fmtDuration(p.durationSec)}</td>
                  <td className="num">
                    {p.paidShare != null ? `${Math.round(p.paidShare * 100)}%` : '—'}
                  </td>
                  <td className="num">{fmtN(p.likes)}</td>
                  <td className="num">{fmtN(p.comments)}</td>
                  <td className="num">{fmtN(p.shares)}</td>
                  <td className="num">{fmtN(p.saves)}</td>
                  <td className="num">{p.engagement != null ? `${p.engagement}%` : '—'}</td>
                  <td className="num">
                    {p.kpiHit === true ? '✓' : p.kpiHit === false ? '✗' : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="funnel-kpi">
      <div className="funnel-kpi-v">{value}</div>
      <div className="funnel-kpi-l muted">{label}</div>
    </div>
  )
}

function fmtN(n: number) {
  return Math.round(n).toLocaleString('de-DE')
}

function fmtDate(iso: string) {
  if (!iso || iso.length < 10) return iso || '—'
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(2, 4)}`
}

function fmtDuration(sec: number | null) {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return '—'
  const s = Math.round(sec)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

function bucketLabel(b: string) {
  if (b === '24h') return '≤24h'
  if (b === '7d') return '≤7d'
  if (b === '30d') return '≤30d'
  return b || 'alt'
}
