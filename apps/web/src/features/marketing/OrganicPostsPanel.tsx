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
  Eye,
  Heart,
  Lightning,
  ShareNetwork,
  UsersThree,
} from '@phosphor-icons/react'
import { FunnelTip } from '../../components/FunnelTip'
import { useI18n } from '../../lib/i18n'
import type { MessageKey } from '../../i18n/messages'

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
  const showReach = META.has(channel)

  const cols = useMemo(() => {
    const base: { key: string; label: string; tip?: MessageKey }[] = [
      { key: 'thumb', label: '' },
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

  const top5 = useMemo(() => {
    return [...filtered]
      .sort((a, b) => (b.engagement ?? -1) - (a.engagement ?? -1) || b.views - a.views)
      .slice(0, 5)
  }, [filtered])

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

  return (
    <div className="stack organic-posts-panel">
      <div className="panel funnel-top5">
        <FunnelTip tip={t('tipTop5')} as="h3" className="section-title funnel-top5-title">
          {t('top5Title')}
        </FunnelTip>
        <div className="funnel-table-wrap">
          <table className="table funnel-top5-table">
            <thead>
              <tr>
                <th>#</th>
                <th>
                  <FunnelTip tip={t('tipColDate')}>{t('colDate')}</FunnelTip>
                </th>
                <th>
                  <FunnelTip tip={t('tipColType')}>{t('colType')}</FunnelTip>
                </th>
                <th>
                  <FunnelTip tip={t('tipColPost')}>{t('colPost')}</FunnelTip>
                </th>
                <th>
                  <FunnelTip tip={t('tipColViews')}>{t('colViews')}</FunnelTip>
                </th>
                {showReach ? (
                  <th>
                    <FunnelTip tip={t('tipColReach')}>{t('colReach')}</FunnelTip>
                  </th>
                ) : null}
                <th>
                  <FunnelTip tip={t('tipColLikes')}>{t('colLikes')}</FunnelTip>
                </th>
                <th>
                  <FunnelTip tip={t('tipColShares')}>{t('colShares')}</FunnelTip>
                </th>
                <th>
                  <FunnelTip tip={t('tipColEr')}>{t('colEr')}</FunnelTip>
                </th>
              </tr>
            </thead>
            <tbody>
              {top5.length === 0 ? (
                <tr>
                  <td colSpan={showReach ? 9 : 8} className="funnel-table-empty muted">
                    {emptyHint}
                  </td>
                </tr>
              ) : (
                top5.map((p, i) => (
                  <tr key={p.id}>
                    <td className="num">{i + 1}</td>
                    <td className="num">{fmtDate(p.date)}</td>
                    <td>
                      <span className="badge">{p.type}</span>
                    </td>
                    <td>{p.title || '—'}</td>
                    <td className="num">{fmtN(p.views)}</td>
                    {showReach ? <td className="num">{p.reach != null ? fmtN(p.reach) : '—'}</td> : null}
                    <td className="num">{fmtN(p.likes)}</td>
                    <td className="num">{fmtN(p.shares)}</td>
                    <td className="num">{p.engagement != null ? `${p.engagement}%` : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="funnel-filters-bar">
        <div className="funnel-filter-row" role="toolbar" aria-label={t('timeWindow')}>
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
        </div>

        <div className="funnel-filter-row" role="toolbar" aria-label={t('filterBrand')}>
          <FunnelTip tip={t('tipBrand')} as="span" className="filter-lbl muted">
            {t('filterBrand')}
          </FunnelTip>
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
          <FunnelTip tip={t('tipPostType')} as="span" className="filter-lbl muted">
            {t('filterPostType')}
          </FunnelTip>
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
        <table className="table funnel-posts-table">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key}>
                  {c.tip ? <FunnelTip tip={t(c.tip)}>{c.label}</FunnelTip> : c.label}
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
              filtered.map((p) => (
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
    <FunnelTip tip={tip} as="div" className="funnel-kpi">
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
