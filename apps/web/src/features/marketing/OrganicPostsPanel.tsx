/**
 * OrganicPostsPanel — Legacy-parity posts table + window chips for organic funnel channels.
 * Columns mirror Legacy dashboard COLS (reach only for Meta). Location: apps/web/src/features/marketing/OrganicPostsPanel.tsx
 */
import { useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import type { Icon } from '@phosphor-icons/react'
import {
  Article,
  BookmarkSimple,
  CaretDown,
  CaretUp,
  ChatCircle,
  Eye,
  FilmStrip,
  Heart,
  Image as ImageIcon,
  Lightning,
  PlayCircle,
  ShareNetwork,
  SquaresFour,
  Stack,
  Storefront,
  UsersThree,
} from '@phosphor-icons/react'
import { FunnelDateRangePicker } from '../../components/FunnelDateRangePicker'
import { FunnelExportMenu } from '../../components/FunnelExportMenu'
import { FunnelTip } from '../../components/FunnelTip'
import { useI18n } from '../../lib/i18n'
import type { MessageKey } from '../../i18n/messages'
import {
  dateInRange,
  defaultDateRange,
  formatPctDelta,
  ORGANIC_PRESETS,
  pctDelta,
  resolveCompareRange,
  type DateRangeValue,
} from '../../lib/dateRange'
import { type FunnelExportPayload } from '../../lib/funnelExport'
import { usePersistedTableColumns, type TableColumnDef } from '../../lib/tableColumns'

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

const META = new Set(['instagram', 'facebook'])

type Props = {
  channel: string
  posts: OrganicPost[]
  emptyHint: string
  /** Prefer over emptyHint when set (e.g. FunnelConnectHint in the empty row). */
  emptyContent?: ReactNode
  initialWindow?: '24h' | '7d' | '30d' | 'all'
  onWindowChange?: (w: '24h' | '7d' | '30d' | 'all') => void
}

export function OrganicPostsPanel({
  channel,
  posts,
  emptyHint,
  emptyContent,
  initialWindow = '30d',
  onWindowChange,
}: Props) {
  const { t } = useI18n()
  const { slug: paramSlug } = useParams()
  const slug = paramSlug || ''
  const [range, setRange] = useState<DateRangeValue>(() => defaultDateRange(initialWindow))
  const [brand, setBrand] = useState('__all__')
  const [postType, setPostType] = useState('__all__')
  const [sortKey, setSortKey] = useState<string>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedTitles, setExpandedTitles] = useState<Record<string, boolean>>({})
  const showReach = META.has(channel)

  const cols = useMemo(() => {
    const base: (TableColumnDef & { tip: MessageKey })[] = [
      { key: 'rank', label: t('colRank'), tip: 'tipColRank' },
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
    return base.map((c) => ({ ...c, description: t(c.tip) }))
  }, [showReach, t])

  const { visibleKeys, visibleColumns, setVisibleKeys, reset } = usePersistedTableColumns({
    slug,
    tableId: 'mkt-organic',
    columns: cols,
  })

  function onRangeChange(next: DateRangeValue) {
    setRange(next)
    if (next.preset === '24h' || next.preset === '7d' || next.preset === '30d' || next.preset === 'all') {
      onWindowChange?.(next.preset)
    } else {
      onWindowChange?.('all')
    }
  }

  const types = useMemo(() => {
    const set = new Set(posts.map((p) => p.type).filter(Boolean))
    return Array.from(set).sort()
  }, [posts])

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (postType !== '__all__' && p.type !== postType) return false
      if (range.preset !== 'all' && !dateInRange(p.date, range.from, range.to)) return false
      return true
    })
  }, [posts, postType, range])

  const compareRows = useMemo(() => {
    const cmp = resolveCompareRange(range)
    if (!cmp) return [] as OrganicPost[]
    return posts.filter((p) => {
      if (postType !== '__all__' && p.type !== postType) return false
      return dateInRange(p.date, cmp.from, cmp.to)
    })
  }, [posts, postType, range])

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
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir(
      key === 'date' || key === 'title' || key === 'type' || key === 'bucket' ? 'asc' : 'desc',
    )
  }

  function sumPosts(rows: OrganicPost[]) {
    const views = rows.reduce((s, p) => s + (p.views || 0), 0)
    const reach = rows.reduce((s, p) => s + (p.reach || 0), 0)
    const likes = rows.reduce((s, p) => s + (p.likes || 0), 0)
    const comments = rows.reduce((s, p) => s + (p.comments || 0), 0)
    const shares = rows.reduce((s, p) => s + (p.shares || 0), 0)
    const saves = rows.reduce((s, p) => s + (p.saves || 0), 0)
    const inter = likes + comments + shares + saves
    return { posts: rows.length, views, reach, inter, likes, comments, shares, saves }
  }

  const kpis = useMemo(() => sumPosts(filtered), [filtered])
  const cmpKpis = useMemo(() => sumPosts(compareRows), [compareRows])
  const showDelta = range.compare !== 'off'

  function getExportPayload(): FunnelExportPayload {
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
    const cmp = resolveCompareRange(range)
    const filters = [
      { label: t('timeWindow'), value: `${range.from} – ${range.to}` },
      { label: t('filterBrand'), value: brand === '__all__' ? t('filterAll') : brand },
      { label: t('filterPostType'), value: postType === '__all__' ? t('filterAll') : postType },
    ]
    if (cmp) {
      filters.push({ label: t('dateCompare'), value: `${cmp.from} – ${cmp.to}` })
    }
    return {
      kind: 'Organic',
      channel,
      from: range.from,
      to: range.to,
      filters,
      kpis: kpiList,
      columns: cols.map((c) => ({ key: c.key, label: c.label })),
      rows: sorted.map((p, i) => exportOrganicRow(p, i + 1, showReach)),
    }
  }

  return (
    <div className="stack organic-posts-panel">
      <div className="funnel-filters-bar">
        <FunnelDateRangePicker
          value={range}
          onChange={onRangeChange}
          presets={ORGANIC_PRESETS}
          dates={posts.map((p) => p.date)}
        />

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
              className={`chip funnel-type-chip ${postType === ty ? 'active' : ''}`}
              data-type={ty}
              onClick={() => setPostType(ty)}
            >
              <PostTypeIcon type={ty} />
              {formatPostTypeLabel(ty)}
              <span className="n">{posts.filter((p) => p.type === ty).length}</span>
            </button>
          ))}
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

      <div className="funnel-kpi-strip" aria-label="KPIs">
        <Kpi
          icon={Article}
          label={t('kpiPosts')}
          value={fmtN(kpis.posts)}
          tip={t('tipKpiPosts')}
          delta={showDelta ? pctDelta(kpis.posts, cmpKpis.posts) : undefined}
        />
        <Kpi
          icon={Eye}
          label={t('colViews')}
          value={fmtN(kpis.views)}
          tip={t('tipKpiViews')}
          delta={showDelta ? pctDelta(kpis.views, cmpKpis.views) : undefined}
        />
        {showReach ? (
          <Kpi
            icon={UsersThree}
            label={t('colReach')}
            value={fmtN(kpis.reach)}
            tip={t('tipKpiReach')}
            delta={showDelta ? pctDelta(kpis.reach, cmpKpis.reach) : undefined}
          />
        ) : null}
        <Kpi
          icon={Lightning}
          label={t('kpiInteractions')}
          value={fmtN(kpis.inter)}
          tip={t('tipKpiInter')}
          delta={showDelta ? pctDelta(kpis.inter, cmpKpis.inter) : undefined}
        />
        <Kpi
          icon={Heart}
          label={t('colLikes')}
          value={fmtN(kpis.likes)}
          tip={t('tipKpiLikes')}
          delta={showDelta ? pctDelta(kpis.likes, cmpKpis.likes) : undefined}
        />
        <Kpi
          icon={ChatCircle}
          label={t('colComments')}
          value={fmtN(kpis.comments)}
          tip={t('tipKpiComments')}
          delta={showDelta ? pctDelta(kpis.comments, cmpKpis.comments) : undefined}
        />
        <Kpi
          icon={ShareNetwork}
          label={t('colShares')}
          value={fmtN(kpis.shares)}
          tip={t('tipKpiShares')}
          delta={showDelta ? pctDelta(kpis.shares, cmpKpis.shares) : undefined}
        />
        <Kpi
          icon={BookmarkSimple}
          label={t('colSaves')}
          value={fmtN(kpis.saves)}
          tip={t('tipKpiSaves')}
          delta={showDelta ? pctDelta(kpis.saves, cmpKpis.saves) : undefined}
        />
      </div>

      <div className="panel funnel-table-wrap">
        <table className="table funnel-grid-table funnel-posts-table">
          <thead>
            <tr>
              {visibleColumns.map((c) => {
                const active = sortKey === c.key
                const tip = cols.find((x) => x.key === c.key)?.tip
                return (
                  <th
                    key={c.key}
                    className={`funnel-th-sortable${active ? ' is-sorted' : ''}`}
                    aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
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
                    {tip ? (
                      <FunnelTip tip={t(tip)} iconOnly>
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
                <td colSpan={Math.max(visibleColumns.length, 1)} className="funnel-table-empty muted">
                  {emptyContent ?? emptyHint}
                </td>
              </tr>
            ) : (
              sorted.map((p, i) => {
                const titleOpen = Boolean(expandedTitles[p.id])
                return (
                  <tr key={p.id}>
                    {visibleColumns.map((col) => (
                      <td
                        key={col.key}
                        className={organicTdClass(col.key)}
                      >
                        {organicCell({
                          key: col.key,
                          post: p,
                          rank: i + 1,
                          showReach,
                          titleOpen,
                          t,
                          onToggleTitle: () =>
                            setExpandedTitles((prev) => ({
                              ...prev,
                              [p.id]: !prev[p.id],
                            })),
                        })}
                      </td>
                    ))}
                  </tr>
                )
              })
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
  delta,
}: {
  icon: Icon
  label: string
  value: string
  tip: string
  delta?: number | null
}) {
  const deltaCls =
    delta == null
      ? ''
      : delta > 0
        ? 'is-up'
        : delta < 0
          ? 'is-down'
          : 'is-flat'
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
      {delta !== undefined ? (
        <div className={`funnel-kpi-delta ${deltaCls}`.trim()}>
          {formatPctDelta(delta)}
        </div>
      ) : null}
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

function formatPostAge(iso: string): {
  relative: string
  bucket: '24h' | '7d' | '30d' | 'older'
  bucketLabel: string
  absolute: string
} {
  const ts = Date.parse(iso)
  if (!Number.isFinite(ts)) {
    return { relative: '—', bucket: 'older', bucketLabel: 'älter', absolute: iso || '—' }
  }
  const ms = Math.max(0, Date.now() - ts)
  const totalH = Math.floor(ms / 3_600_000)
  const d = Math.floor(totalH / 24)
  const h = totalH % 24
  const relative =
    totalH < 1
      ? `<1h`
      : d === 0
        ? `${h}h`
        : h === 0
          ? `${d}d`
          : `${d}d ${h}h`
  const bucket: '24h' | '7d' | '30d' | 'older' =
    totalH <= 24 ? '24h' : totalH <= 24 * 7 ? '7d' : totalH <= 24 * 30 ? '30d' : 'older'
  const bucketLabel =
    bucket === '24h' ? '≤24h' : bucket === '7d' ? '≤7d' : bucket === '30d' ? '≤30d' : 'älter'
  return { relative, bucket, bucketLabel, absolute: new Date(ts).toLocaleString('de-DE') }
}

function formatPostTypeLabel(type: string | null | undefined): string {
  const raw = (type || 'post').trim()
  if (!raw) return 'Post'
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
}

function PostTypeIcon({ type }: { type: string }) {
  const t = (type || 'post').toLowerCase()
  if (t === 'reel' || t === 'short') return <FilmStrip size={12} weight="bold" aria-hidden />
  if (t === 'video') return <PlayCircle size={12} weight="bold" aria-hidden />
  if (t === 'carousel' || t === 'album') return <Stack size={12} weight="bold" aria-hidden />
  if (t === 'story') return <ImageIcon size={12} weight="bold" aria-hidden />
  return <Article size={12} weight="bold" aria-hidden />
}

function MetricOrWhy({ value, why }: { value: string | null; why: string }) {
  if (value != null) return <>{value}</>
  return (
    <span className="funnel-metric-empty muted" title={why}>
      —
      <span className="funnel-metric-why">{why}</span>
    </span>
  )
}

function organicTdClass(key: string): string | undefined {
  if (key === 'rank') return 'num funnel-rank-cell'
  if (key === 'bucket') return 'funnel-age-cell'
  if (key === 'title') return 'funnel-post-title-cell'
  if (key === 'type') return undefined
  return 'num'
}

function organicCell(opts: {
  key: string
  post: OrganicPost
  rank: number
  showReach: boolean
  titleOpen: boolean
  t: (k: MessageKey) => string
  onToggleTitle: () => void
}): ReactNode {
  const { key, post: p, rank, showReach, titleOpen, t, onToggleTitle } = opts
  switch (key) {
    case 'rank':
      return rank
    case 'date':
      return fmtDate(p.date)
    case 'type':
      return (
        <span className="badge funnel-type-badge" data-type={p.type || 'post'}>
          <PostTypeIcon type={p.type} />
          <span>{formatPostTypeLabel(p.type)}</span>
        </span>
      )
    case 'bucket': {
      const age = formatPostAge(p.date)
      return (
        <div className="funnel-age-stack" title={`${t('colAge')}: ${age.absolute}`}>
          <span className="funnel-age-relative">{age.relative}</span>
          <span className="badge funnel-age-bucket" data-bucket={age.bucket}>
            {age.bucketLabel}
          </span>
        </div>
      )
    }
    case 'title': {
      const titleText = p.title || '—'
      const titleLong = titleText.length > 42
      return (
        <div className={`funnel-post-title${titleOpen ? ' is-open' : ''}`}>
          {p.url ? (
            <a href={p.url} target="_blank" rel="noopener noreferrer">
              {titleOpen || !titleLong ? titleText : `${titleText.slice(0, 40)}…`}
            </a>
          ) : (
            <span>{titleOpen || !titleLong ? titleText : `${titleText.slice(0, 40)}…`}</span>
          )}
          {titleLong ? (
            <button
              type="button"
              className="btn funnel-title-toggle"
              aria-expanded={titleOpen}
              onClick={onToggleTitle}
            >
              {titleOpen ? (
                <>
                  <CaretUp size={12} weight="bold" aria-hidden />
                  {t('funnelTitleCollapse')}
                </>
              ) : (
                <>
                  <CaretDown size={12} weight="bold" aria-hidden />
                  {t('funnelTitleExpand')}
                </>
              )}
            </button>
          ) : null}
        </div>
      )
    }
    case 'views':
      return fmtN(p.views)
    case 'reach':
      return (
        <MetricOrWhy
          value={p.reach != null ? fmtN(p.reach) : null}
          why={t('metricWhyNoReach')}
        />
      )
    case 'shareRate':
      return (
        <MetricOrWhy
          value={p.sharesPer1000 != null ? String(p.sharesPer1000) : null}
          why={t('metricWhyNoShareRate')}
        />
      )
    case 'saveRate':
      return (
        <MetricOrWhy
          value={
            showReach
              ? p.savesPer1000 != null
                ? String(p.savesPer1000)
                : null
              : p.savesPer100 != null
                ? String(p.savesPer100)
                : null
          }
          why={t('metricWhyNoSaveRate')}
        />
      )
    case 'watch':
      return (
        <MetricOrWhy
          value={p.watchPct != null ? `${p.watchPct}%` : null}
          why={t('metricWhyWatchVideoOnly')}
        />
      )
    case 'duration':
      return (
        <MetricOrWhy
          value={
            p.durationSec != null && Number.isFinite(p.durationSec)
              ? fmtDuration(p.durationSec)
              : null
          }
          why={t('metricWhyDurationVideoOnly')}
        />
      )
    case 'paid':
      return (
        <MetricOrWhy
          value={p.paidShare != null ? `${Math.round(p.paidShare * 100)}%` : null}
          why={t('metricWhyNoPaidShare')}
        />
      )
    case 'likes':
      return fmtN(p.likes)
    case 'comments':
      return fmtN(p.comments)
    case 'shares':
      return fmtN(p.shares)
    case 'saves':
      return fmtN(p.saves)
    case 'er':
      return (
        <MetricOrWhy
          value={p.engagement != null ? `${p.engagement}%` : null}
          why={t('metricWhyNoEr')}
        />
      )
    case 'kpi':
      return (
        <MetricOrWhy
          value={p.kpiHit === true ? '✓' : p.kpiHit === false ? '✗' : null}
          why={t('metricWhyNoKpi')}
        />
      )
    default:
      return '—'
  }
}

function exportOrganicRow(
  p: OrganicPost,
  rank: number,
  showReach: boolean,
): Record<string, string | number | null> {
  const row: Record<string, string | number | null> = {
    rank,
    date: fmtDate(p.date),
    type: formatPostTypeLabel(p.type),
    bucket: formatPostAge(p.date).relative,
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
    case 'rank':
      // Performance rank (same signal as former Top5): engagement rate
      return p.engagement
    case 'date':
      return p.date || ''
    case 'type':
      return p.type || ''
    case 'bucket': {
      const age = formatPostAge(p.date)
      return age.bucket === '24h' ? 1 : age.bucket === '7d' ? 2 : age.bucket === '30d' ? 3 : 4
    }
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
