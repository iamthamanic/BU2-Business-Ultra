/**
 * OrganicProductionPanel — Produktion tab: calendar shell + draft compose (Metricool-style hub).
 * Shares Analyse filter chrome (Zeitraum / Brand / Post-Art). Full planner UX lands iteratively.
 * Location: apps/web/src/features/marketing/OrganicProductionPanel.tsx
 */
import { useMemo, useState } from 'react'
import { CaretLeft, CaretRight, Plus, SquaresFour, Storefront } from '@phosphor-icons/react'
import { FunnelDateRangePicker } from '../../components/FunnelDateRangePicker'
import { FunnelTip } from '../../components/FunnelTip'
import { useI18n } from '../../lib/i18n'
import {
  defaultDateRange,
  ORGANIC_PRESETS,
  type DateRangeValue,
} from '../../lib/dateRange'
import type { OrganicPost } from './OrganicPostsPanel'

type DraftRow = {
  id: string
  title?: string | null
  remoteStatus?: unknown
}

type WindowKey = '24h' | '7d' | '30d' | 'all'

type Props = {
  posts?: OrganicPost[]
  drafts: DraftRow[]
  contentReady: boolean
  initialWindow?: WindowKey
  onWindowChange?: (w: WindowKey) => void
  onCreateDraft: (title: string, text: string) => void | Promise<void>
  onSchedule: (id: string) => void | Promise<void>
  onRetry: (id: string) => void | Promise<void>
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

function weekdayMon0(d: Date) {
  return (d.getDay() + 6) % 7
}

export function OrganicProductionPanel({
  posts = [],
  drafts,
  contentReady,
  initialWindow = '30d',
  onWindowChange,
  onCreateDraft,
  onSchedule,
  onRetry,
}: Props) {
  const { t, locale } = useI18n()
  const [range, setRange] = useState<DateRangeValue>(() => defaultDateRange(initialWindow))
  const [brand, setBrand] = useState('__all__')
  const [postType, setPostType] = useState('__all__')
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)

  const types = useMemo(() => {
    const set = new Set(posts.map((p) => p.type).filter(Boolean))
    return Array.from(set).sort()
  }, [posts])

  function onRangeChange(next: DateRangeValue) {
    setRange(next)
    if (next.preset === '24h' || next.preset === '7d' || next.preset === '30d' || next.preset === 'all') {
      onWindowChange?.(next.preset)
    } else {
      onWindowChange?.('all')
    }
  }

  const monthLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'de-DE', {
        month: 'long',
        year: 'numeric',
      }).format(cursor)
    } catch {
      return `${cursor.getMonth() + 1}/${cursor.getFullYear()}`
    }
  }, [cursor, locale])

  const cells = useMemo(() => {
    const total = daysInMonth(cursor)
    const pad = weekdayMon0(cursor)
    const today = new Date()
    const out: { day: number | null; isToday: boolean }[] = []
    for (let i = 0; i < pad; i++) out.push({ day: null, isToday: false })
    for (let d = 1; d <= total; d++) {
      const isToday =
        today.getFullYear() === cursor.getFullYear() &&
        today.getMonth() === cursor.getMonth() &&
        today.getDate() === d
      out.push({ day: d, isToday })
    }
    while (out.length % 7 !== 0) out.push({ day: null, isToday: false })
    return out
  }, [cursor])

  const weekdays =
    locale === 'en'
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

  async function saveDraft() {
    await onCreateDraft(title, text)
    setTitle('')
    setText('')
    setComposerOpen(false)
  }

  return (
    <div className="stack organic-production-panel">
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
              className={`chip ${postType === ty ? 'active' : ''}`}
              onClick={() => setPostType(ty)}
            >
              {ty}
              <span className="n">{posts.filter((p) => p.type === ty).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="prod-toolbar">
        <div className="prod-month-nav">
          <button
            type="button"
            className="btn icon-btn"
            aria-label={t('prodPrevMonth')}
            onClick={() =>
              setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))
            }
          >
            <CaretLeft size={16} weight="bold" />
          </button>
          <h2 className="prod-month-label">{monthLabel}</h2>
          <button
            type="button"
            className="btn icon-btn"
            aria-label={t('prodNextMonth')}
            onClick={() =>
              setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
            }
          >
            <CaretRight size={16} weight="bold" />
          </button>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={() => setComposerOpen(true)}
        >
          <Plus size={16} weight="bold" aria-hidden />
          {t('prodCreatePost')}
        </button>
      </div>

      <p className="muted prod-lede">{t('prodLede')}</p>

      <div className="prod-calendar panel" role="grid" aria-label={t('prodCalendar')}>
        <div className="prod-cal-head" role="row">
          {weekdays.map((w) => (
            <div key={w} className="prod-cal-dow muted" role="columnheader">
              {w}
            </div>
          ))}
        </div>
        <div className="prod-cal-body">
          {cells.map((cell, i) => (
            <button
              key={i}
              type="button"
              role="gridcell"
              className={`prod-cal-cell${cell.day == null ? ' is-empty' : ''}${cell.isToday ? ' is-today' : ''}`}
              disabled={cell.day == null}
              onClick={() => {
                if (cell.day != null) setComposerOpen(true)
              }}
            >
              {cell.day != null ? <span className="prod-cal-day">{cell.day}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {composerOpen ? (
        <div className="panel prod-composer stack">
          <div className="prod-composer-head">
            <strong>{t('composeDrafts')}</strong>
            <button type="button" className="btn ghost" onClick={() => setComposerOpen(false)}>
              {t('dateRangeCancel')}
            </button>
          </div>
          <input
            className="input"
            placeholder={t('draftTitlePh')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="textarea"
            placeholder={t('draftTextPh')}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn primary" type="button" onClick={() => void saveDraft()}>
              {t('saveDraft')}
            </button>
          </div>
        </div>
      ) : null}

      <div className="panel stack" style={{ gap: 12 }}>
        <strong>{t('draftsList')}</strong>
        <table className="table">
          <thead>
            <tr>
              <th>{t('name')}</th>
              <th>Remote</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {drafts.length === 0 ? (
              <tr>
                <td colSpan={3} className="funnel-table-empty muted">
                  {t('funnelEmpty')}
                </td>
              </tr>
            ) : (
              drafts.map((d) => (
                <tr key={d.id}>
                  <td>{d.title}</td>
                  <td className="kpi" style={{ maxWidth: 280, overflow: 'hidden' }}>
                    {JSON.stringify(d.remoteStatus ?? {})}
                  </td>
                  <td className="row">
                    <button
                      className="btn"
                      type="button"
                      disabled={!contentReady}
                      onClick={() => void onSchedule(d.id)}
                    >
                      {t('schedule')}
                    </button>
                    <button
                      className="btn"
                      type="button"
                      disabled={!contentReady}
                      onClick={() => void onRetry(d.id)}
                    >
                      {t('retry')}
                    </button>
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
