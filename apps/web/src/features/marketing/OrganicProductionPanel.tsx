/**
 * OrganicProductionPanel — Produktion tab: calendar driven by Zeitraum filter.
 * Shows every month spanned by the selected range side-by-side; days in-range are highlighted.
 * Location: apps/web/src/features/marketing/OrganicProductionPanel.tsx
 */
import { useMemo, useState } from 'react'
import { Plus, SquaresFour, Storefront } from '@phosphor-icons/react'
import { CreatePostModal } from '../../components/CreatePostModal'
import { FunnelDateRangePicker } from '../../components/FunnelDateRangePicker'
import { FunnelTip } from '../../components/FunnelTip'
import { useI18n } from '../../lib/i18n'
import { formatIsoDate } from '../../lib/funnelExport'
import {
  defaultDateRange,
  formatDisplayRange,
  ORGANIC_PRESETS,
  type DateRangeValue,
} from '../../lib/dateRange'
import type { OrganicPost } from './OrganicPostsPanel'

type WindowKey = '24h' | '7d' | '30d' | 'all'

type Props = {
  posts?: OrganicPost[]
  initialWindow?: WindowKey
  onWindowChange?: (w: WindowKey) => void
}

type CalCell = {
  day: number | null
  iso: string | null
  inRange: boolean
  isToday: boolean
}

const MAX_MONTHS = 12

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

function weekdayMon0(d: Date) {
  return (d.getDay() + 6) % 7
}

function parseIsoDay(iso: string | undefined): Date | null {
  if (!iso || iso.length < 10 || iso === 'all') return null
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function monthsBetween(from: Date, to: Date): Date[] {
  const start = startOfMonth(from <= to ? from : to)
  const end = startOfMonth(from <= to ? to : from)
  const out: Date[] = []
  let cur = new Date(start)
  while (cur.getTime() <= end.getTime() && out.length < MAX_MONTHS) {
    out.push(new Date(cur))
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  }
  return out
}

function buildMonthCells(
  month: Date,
  rangeFrom: string,
  rangeTo: string,
  todayIso: string,
): CalCell[] {
  const total = daysInMonth(month)
  const pad = weekdayMon0(month)
  const out: CalCell[] = []
  for (let i = 0; i < pad; i++) {
    out.push({ day: null, iso: null, inRange: false, isToday: false })
  }
  for (let d = 1; d <= total; d++) {
    const iso = formatIsoDate(new Date(month.getFullYear(), month.getMonth(), d))
    out.push({
      day: d,
      iso,
      inRange: iso >= rangeFrom && iso <= rangeTo,
      isToday: iso === todayIso,
    })
  }
  while (out.length % 7 !== 0) {
    out.push({ day: null, iso: null, inRange: false, isToday: false })
  }
  return out
}

export function OrganicProductionPanel({
  posts = [],
  initialWindow = '30d',
  onWindowChange,
}: Props) {
  const { t, locale } = useI18n()
  const [range, setRange] = useState<DateRangeValue>(() => defaultDateRange(initialWindow))
  const [draftRange, setDraftRange] = useState<DateRangeValue | null>(null)
  const [brand, setBrand] = useState('__all__')
  const [postType, setPostType] = useState('__all__')
  const [composerOpen, setComposerOpen] = useState(false)

  const activeRange = draftRange ?? range

  const types = useMemo(() => {
    const set = new Set(posts.map((p) => p.type).filter(Boolean))
    return Array.from(set).sort()
  }, [posts])

  function onRangeChange(next: DateRangeValue) {
    setRange(next)
    setDraftRange(null)
    if (next.preset === '24h' || next.preset === '7d' || next.preset === '30d' || next.preset === 'all') {
      onWindowChange?.(next.preset)
    } else {
      onWindowChange?.('all')
    }
  }

  const todayIso = formatIsoDate(new Date())

  const boundRange = useMemo(() => {
    let from = parseIsoDay(activeRange.from)
    let to = parseIsoDay(activeRange.to)
    if (!from || !to) {
      const postDates = posts
        .map((p) => p.date?.slice(0, 10))
        .filter((d): d is string => Boolean(d && d.length >= 10))
        .sort()
      if (postDates.length) {
        from = parseIsoDay(postDates[0]!)
        to = parseIsoDay(postDates[postDates.length - 1]!)
      } else {
        const now = new Date()
        from = startOfMonth(now)
        to = now
      }
    }
    if (!from || !to) {
      const now = new Date()
      return { from: formatIsoDate(now), to: formatIsoDate(now), fromDate: now, toDate: now }
    }
    if (from.getTime() > to.getTime()) {
      const tmp = from
      from = to
      to = tmp
    }
    return {
      from: formatIsoDate(from),
      to: formatIsoDate(to),
      fromDate: from,
      toDate: to,
    }
  }, [activeRange.from, activeRange.to, posts])

  const monthBlocks = useMemo(() => {
    const months = monthsBetween(boundRange.fromDate, boundRange.toDate)
    const loc = locale === 'en' ? 'en-US' : 'de-DE'
    return months.map((month) => {
      let label: string
      try {
        label = new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(month)
      } catch {
        label = `${month.getMonth() + 1}/${month.getFullYear()}`
      }
      return {
        key: `${month.getFullYear()}-${month.getMonth()}`,
        label,
        cells: buildMonthCells(month, boundRange.from, boundRange.to, todayIso),
      }
    })
  }, [boundRange, locale, todayIso])

  const weekdays =
    locale === 'en'
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

  const monthSpanCount = monthBlocks.length
  const truncated =
    monthSpanCount >= MAX_MONTHS &&
    (() => {
      const end = startOfMonth(boundRange.toDate)
      const last = monthBlocks[monthBlocks.length - 1]
      if (!last) return false
      const [y, m] = last.key.split('-').map(Number)
      const lastMonth = new Date(y!, m!, 1)
      return lastMonth.getTime() < end.getTime()
    })()

  return (
    <div className="stack organic-production-panel">
      <div className="funnel-filters-bar">
        <FunnelDateRangePicker
          value={range}
          onChange={onRangeChange}
          onDraftChange={setDraftRange}
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
              className={`chip ${postType === ty ? 'active' : ''}`}
              onClick={() => setPostType(ty)}
            >
              {ty}
              <span className="n">{posts.filter((p) => p.type === ty).length}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn primary prod-create-in-bar"
          onClick={() => setComposerOpen(true)}
        >
          <Plus size={16} weight="bold" aria-hidden />
          {t('prodCreatePost')}
        </button>
      </div>

      <div className="prod-range-meta">
        <strong className="prod-range-meta-count">
          {monthSpanCount === 1
            ? t('prodMonthsOne')
            : t('prodMonthsMany').replace('{n}', String(monthSpanCount))}
        </strong>
        <span className="prod-range-meta-sep" aria-hidden>
          ·
        </span>
        <span className="muted prod-range-meta-dates">
          {formatDisplayRange(boundRange.from, boundRange.to)}
        </span>
        {truncated ? <span className="muted prod-range-cap">{t('prodMonthsCap')}</span> : null}
      </div>

      <div
        className="prod-calendars"
        data-months={Math.min(monthSpanCount, 4)}
        aria-label={t('prodCalendar')}
      >
        {monthBlocks.map((block) => (
          <div key={block.key} className="prod-calendar panel">
            <h3 className="prod-month-heading">{block.label}</h3>
            <div className="prod-cal-head" role="row">
              {weekdays.map((w) => (
                <div key={w} className="prod-cal-dow muted" role="columnheader">
                  {w}
                </div>
              ))}
            </div>
            <div className="prod-cal-body" role="grid">
              {block.cells.map((cell, i) => (
                <div
                  key={i}
                  role="gridcell"
                  className={[
                    'prod-cal-cell',
                    cell.day == null ? 'is-empty' : '',
                    cell.inRange ? 'is-in-range' : 'is-out-range',
                    cell.isToday ? 'is-today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-disabled={cell.day == null || !cell.inRange}
                >
                  {cell.day != null ? <span className="prod-cal-day">{cell.day}</span> : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <CreatePostModal open={composerOpen} onClose={() => setComposerOpen(false)} />
    </div>
  )
}
