/**
 * OrganicPostsPanel — Legacy-parity posts table + window chips for organic funnel channels.
 * Columns mirror Legacy dashboard COLS (reach only for Meta). Location: apps/web/src/features/marketing/OrganicPostsPanel.tsx
 */
import { useMemo, useState } from 'react'
import type { Icon } from '@phosphor-icons/react'
import {
  Article,
  BookmarkSimple,
  ChatCircle,
  Clock,
  Eye,
  Heart,
  Lightning,
  ShareNetwork,
  SquaresFour,
  Storefront,
  UsersThree,
} from '@phosphor-icons/react'
import { FunnelExportMenu } from '../../components/FunnelExportMenu'
import { FunnelTip } from '../../components/FunnelTip'
import { useI18n } from '../../lib/i18n'
import type { MessageKey } from '../../i18n/messages'
import {
  windowToDateRange,
  type FunnelExportPayload,
} from '../../lib/funnelExport'

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
  const [brand, setBrand] = useState('__all__')
  const [postType, setPostType] = useState('__all__')
  const [sortKey, setSortKey] = useState<string>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const showReach = META.has(channel)

  const cols = useMemo(() => {
    const base: { key: string; label: string; tip?: MessageKey }[] = [
      { key: 'rank', label: t('colRank') },
      { key: 'date', label: t('colDate'), tip: 'tipColDate' },
      { key: 'type', label: t('colType'), tip: 'tipColType' },
      { key: 'bucket', label: t('colAge'), tip: 'tipColAge' },
      { key: 'title', label: t('colPost'), tip: 'tipColPost' },
      { key: 'views', label: t('colViews'), tip: 'tipColViews' },
    ]
    if (showReach) base.push({ key: 'reach', label: t('colReach'), tip: 'tipColReach' })
    base.push(
      {
        key: 'shareRate',
        label: showReach ? t('colShareRate') : t('colShPer1k'),
        tip: showReach ? 'tipColShareRate' : 'tipColShPer1k',
      },
      {
        key: 'saveRate',
        label: showReach ? t('colSaveRate') : t('colSaPer100'),
        tip: showReach ? 'tipColSaveRate' : 'tipColSaPer100',
      },
      { key: 'watch', label: t('colWatch'), tip: 'tipColWatch' },
      { key: 'duration', label: t('colDuration'), tip: 'tipColDuration' },
      { key: 'paid', label: t('colPaidShare'), tip: 'tipColPaid' },
      { key: 'likes', label: t('colLikes'), tip: 'tipColLikes' },
      { key: 'comments', label: t('colComments'), tip: 'tipColComments' },
      { key: 'shares', label: t('colShares'), tip: 'tipColShares' },
      { key: 'saves', label: t('colSaves'), tip: 'tipColSaves' },
      { key: 'er', label: t('colEr'), tip: 'tipColEr' },
      { key: 'kpi', label: t('colKpi'), tip: 'tipColKpi' },
    )
    return base
  }, [showReach, t])

  function pickWindow(w: WindowKey) {
    setWin(w)
    onWindowChange?.(w)
  }

  const types = useMemo(() => {
    const set = new Set(posts.map((p) => p.type).filter(Boolean))
    return Array.from(set).sort()
  }, [posts])

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (postType !== '__all__' && p.type !== postType) return false
      return true
    })
  }, [posts, postType])

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sortKey, showReach)
      const bv = sortValue(b, sortKey, showReach)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv, 'de') * dir
      }
      return ((av as number) - (bv as number)) * dir
    })
  }, [filtered, sortKey, sortDir, showReach])

  function toggleSort(key: string) {
    if (key === 'rank') return
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'date' || key === 'title' || key === 'type' || key === 'bucket' ? 'asc' : 'desc')
  }

  const kpis = useMemo(() => {
    const views = filtered.reduce((s, p) => s + (p.views || 0), 0)
    const reach = filtered.reduce((s, p) => s + (p.reach || 0), 0)
    const likes = filtered.reduce((s, p) => s + (p.likes || 0), 0)
    const comments = filtered.reduce((s, p) => s + (p.comments || 0), 0)
    const shares = filtered.reduce((s, p) => s + (p.shares || 0), 0)
    const saves = filtered.reduce((s, p) => s + (p.saves || 0), 0)
    const inter = likes + comments + shares + saves
    return { posts: filtered.length, views, reach, inter, likes, comments, shares, saves }
  }, [filtered])

  function getExportPayload(): FunnelExportPayload {
    const range = windowToDateRange(win, { dates: sorted.map((p) => p.date) })
    const winLabel = WINDOWS.find((w) => w.key === win)
    const kpiList = [
      { label: t('kpiPosts'), value: fmtN(kpis.posts) },
      { label: t('colViews'), value: fmtN(kpis.views) },
    ]
    if (showReach) kpiList.push({ label: t('colReach'), value: fmtN(kpis.reach) })
    kpiList.push(
      { label: t('kpiInteractions'), value: fmtN(kpis.inter) },
      { label: t('colLikes'), value: fmtN(kpis.likes) },
      { label: t('colComments'), value: fmtN(kpis.comments) },
      { label: t('colShares'), value: fmtN(kpis.shares) },
      { label: t('colSaves'), value: fmtN(kpis.saves) },
    )
    return {
      kind: 'Organic',
      channel,
      from: range.from,
      to: range.to,
      filters: [
        { label: t('timeWindow'), value: winLabel ? t(winLabel.labelKey) : win },
        { label: t('filterBrand'), value: brand === '__all__' ? t('filterAll') : brand },
        { label: t('filterPostType'), value: postType === '__all__' ? t('filterAll') : postType },
      ],
      kpis: kpiList,
      columns: cols.map((c) => ({ key: c.key, label: c.label })),
      rows: sorted.map((p, i) => exportOrganicRow(p, i + 1, showReach)),
    }
  }

  return (
    <div className="stack organic-posts-panel">
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
              onClick={() => pickWindow(w.key)}
            >
              {t(w.labelKey)}
              <span className="n">{w.key === win ? filtered.length : '·'}</span>
            </button>
          ))}
        </div>

        <div className="funnel-filter-row" role="toolbar" aria-label={t('filterBrand')}>
          <span className="filter-lbl muted">
            <Storefront className="filter-lbl-ic" size={14} weight="duotone" aria-hidden />
            <FunnelTip tip={t('tipBrand')}>{t('filterBrand')}</FunnelTip>
          </span>
          <button
            type="button"
            className={`chip ${brand === '__all__' ? 'active' : ''}`}
            onClick={() => setBrand('__all__')}
          >
            {t('filterAll')}
            <span className="n">{posts.length}</span>
          </button>
        </div>

        <div className="funnel-filter-row" role="toolbar" aria-label={t('filterPostType')}>
          <span className="filter-lbl muted">
            <SquaresFour className="filter-lbl-ic" size={14} weight="duotone" aria-hidden />
            <FunnelTip tip={t('tipPostType')}>{t('filterPostType')}</FunnelTip>
          </span>
          <button
            type="button"
            className={`chip ${postType === '__all__' ? 'active' : ''}`}
            onClick={() => setPostType('__all__')}
          >
            {t('filterAll')}
            <span className="n">{posts.length}</span>
          </button>
          {types.map((ty) => (
            <button
              key={ty}
              type="button"
              className={`chip ${postType === ty ? 'active' : ''}`}
              onClick={() => setPostType(ty)}
            >
              {ty}
              <span className="n">{posts.filter((p) => p.type === ty).length}</span>
            </button>
          ))}
        </div>

        <FunnelExportMenu getPayload={getExportPayload} />
      </div>

      <div className="funnel-kpi-strip" aria-label="KPIs">
        <Kpi icon={Article} label={t('kpiPosts')} value={fmtN(kpis.posts)} tip={t('tipKpiPosts')} />
        <Kpi icon={Eye} label={t('colViews')} value={fmtN(kpis.views)} tip={t('tipKpiViews')} />
        {showReach ? (
          <Kpi icon={UsersThree} label={t('colReach')} value={fmtN(kpis.reach)} tip={t('tipKpiReach')} />
        ) : null}
        <Kpi
          icon={Lightning}
          label={t('kpiInteractions')}
          value={fmtN(kpis.inter)}
          tip={t('tipKpiInter')}
        />
        <Kpi icon={Heart} label={t('colLikes')} value={fmtN(kpis.likes)} tip={t('tipKpiLikes')} />
        <Kpi
          icon={ChatCircle}
          label={t('colComments')}
          value={fmtN(kpis.comments)}
          tip={t('tipKpiComments')}
        />
        <Kpi
          icon={ShareNetwork}
          label={t('colShares')}
          value={fmtN(kpis.shares)}
          tip={t('tipKpiShares')}
        />
        <Kpi
          icon={BookmarkSimple}
          label={t('colSaves')}
          value={fmtN(kpis.saves)}
          tip={t('tipKpiSaves')}
        />
      </div>

      <div className="panel funnel-table-wrap">
        <table className="table funnel-grid-table funnel-posts-table">
          <thead>
            <tr>
              {cols.map((c) => {
                const sortable = c.key !== 'rank'
                const active = sortKey === c.key
                return (
                  <th
                    key={c.key}
                    className={sortable ? `funnel-th-sortable${active ? ' is-sorted' : ''}` : undefined}
                    aria-sort={
                      sortable && active ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                  >
                    {sortable ? (
                      <button
                        type="button"
                        className="funnel-th-btn"
                        onClick={() => toggleSort(c.key)}
                      >
                        <span>{c.label}</span>
                        <span className="funnel-th-dir" aria-hidden>
                          {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </button>
                    ) : (
                      c.label
                    )}
                    {c.tip ? (
                      <FunnelTip tip={t(c.tip)} iconOnly>
                        {c.label}
                      </FunnelTip>
                    ) : null}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={cols.length} className="funnel-table-empty muted">
                  {emptyHint}
                </td>
              </tr>
            ) : (
              sorted.map((p, i) => (
                <tr key={p.id}>
                  <td className="num funnel-rank-cell">{i + 1}</td>
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
                    {p.sharesPer1000 != null ? String(p.sharesPer1000) : '—'}
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

function Kpi({
  icon: Ic,
  label,
  value,
  tip,
}: {
  icon: Icon
  label: string
  value: string
  tip: string
}) {
  return (
    <div className="funnel-kpi">
      <div className="funnel-kpi-head">
        <span className="funnel-kpi-ic" aria-hidden>
          <Ic size={16} weight="duotone" />
        </span>
        <div className="funnel-kpi-l muted">{label}</div>
        <FunnelTip tip={tip} iconOnly>
          {label}
        </FunnelTip>
      </div>
      <div className="funnel-kpi-v">{value}</div>
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

function exportOrganicRow(
  p: OrganicPost,
  rank: number,
  showReach: boolean,
): Record<string, string | number | null> {
  const row: Record<string, string | number | null> = {
    rank,
    date: fmtDate(p.date),
    type: p.type || '—',
    bucket: bucketLabel(p.bucket),
    title: p.title || '—',
    views: p.views,
    shareRate: p.sharesPer1000 != null ? String(p.sharesPer1000) : '—',
    saveRate: showReach
      ? p.savesPer1000 != null
        ? String(p.savesPer1000)
        : '—'
      : p.savesPer100 != null
        ? String(p.savesPer100)
        : '—',
    watch: p.watchPct != null ? `${p.watchPct}%` : '—',
    duration: fmtDuration(p.durationSec),
    paid: p.paidShare != null ? `${Math.round(p.paidShare * 100)}%` : '—',
    likes: p.likes,
    comments: p.comments,
    shares: p.shares,
    saves: p.saves,
    er: p.engagement != null ? `${p.engagement}%` : '—',
    kpi: p.kpiHit === true ? '✓' : p.kpiHit === false ? '✗' : '—',
  }
  if (showReach) row.reach = p.reach != null ? p.reach : '—'
  return row
}

function sortValue(
  p: OrganicPost,
  key: string,
  showReach: boolean,
): string | number | null {
  switch (key) {
    case 'date':
      return p.date || ''
    case 'type':
      return p.type || ''
    case 'bucket':
      return p.bucket === '24h' ? 1 : p.bucket === '7d' ? 2 : p.bucket === '30d' ? 3 : 4
    case 'title':
      return (p.title || '').toLowerCase()
    case 'views':
      return p.views
    case 'reach':
      return p.reach
    case 'shareRate':
      return p.sharesPer1000
    case 'saveRate':
      return showReach ? p.savesPer1000 : p.savesPer100
    case 'watch':
      return p.watchPct
    case 'duration':
      return p.durationSec
    case 'paid':
      return p.paidShare
    case 'likes':
      return p.likes
    case 'comments':
      return p.comments
    case 'shares':
      return p.shares
    case 'saves':
      return p.saves
    case 'er':
      return p.engagement
    case 'kpi':
      return p.kpiHit === true ? 1 : p.kpiHit === false ? 0 : null
    default:
      return null
  }
}
