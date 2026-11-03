/**
 * FunnelDateRangePicker — premium Google-Ads-style period + compare popover (Dark-Ops).
 * Location: apps/web/src/components/FunnelDateRangePicker.tsx
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowsLeftRight, CalendarBlank, CaretDown } from '@phosphor-icons/react'
import { useI18n } from '../lib/i18n'
import type { MessageKey } from '../i18n/messages'
import { formatIsoDate } from '../lib/funnelExport'
import {
  formatDisplayDate,
  formatDisplayRange,
  isValidRange,
  previousPeriod,
  previousYear,
  rangeFromPreset,
  resolveCompareRange,
  withResolvedPrimary,
  type CompareMode,
  type DateRangePreset,
  type DateRangeValue,
} from '../lib/dateRange'

type Props = {
  value: DateRangeValue
  onChange: (next: DateRangeValue) => void
  /** Live draft while the popover is open (null when closed). Used by Produktion calendar preview. */
  onDraftChange?: (draft: DateRangeValue | null) => void
  presets: DateRangePreset[]
  dates?: string[]
  /** Hide compare switch + compare UI (CRM notes, etc.). */
  hideCompare?: boolean
  /** Narrow stacked popover for tight headers. */
  compact?: boolean
  /** Show leading “Zeitraum” label beside the trigger. Default true. */
  showLabel?: boolean
  /** Prefer aligning popover to trigger start (left) or end (right). */
  popoverAlign?: 'start' | 'end'
  className?: string
}

const PRESET_LABEL: Record<Exclude<DateRangePreset, 'custom'>, MessageKey> = {
  '24h': 'win24h',
  '7d': 'win7d',
  '30d': 'win30d',
  '90d': 'win90d',
  all: 'winAll',
}

type PopoverPos = { top: number; left: number; width: number }

export function FunnelDateRangePicker({
  value,
  onChange,
  onDraftChange,
  presets,
  dates,
  hideCompare = false,
  compact = false,
  showLabel = true,
  popoverAlign = 'start',
  className = '',
}: Props) {
  const { t } = useI18n()
  const titleId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRangeValue>(value)
  const [popoverPos, setPopoverPos] = useState<PopoverPos | null>(null)

  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  useEffect(() => {
    if (!onDraftChange) return
    onDraftChange(open ? draft : null)
  }, [open, draft, onDraftChange])

  function placePopover() {
    const btn = triggerRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const pad = 12
    const width = Math.min(compact ? 360 : 580, window.innerWidth - pad * 2)
    let left = popoverAlign === 'end' ? r.right - width : r.left
    left = Math.max(pad, Math.min(left, window.innerWidth - width - pad))
    const estH = popoverRef.current?.offsetHeight || (compact ? 300 : 360)
    let top = r.bottom + 8
    if (top + estH > window.innerHeight - pad) {
      top = Math.max(pad, r.top - estH - 8)
    }
    setPopoverPos({ top, left, width })
  }

  useLayoutEffect(() => {
    if (!open) {
      setPopoverPos(null)
      return
    }
    placePopover()
    // Re-measure after compact layout paints.
    const id = window.requestAnimationFrame(() => placePopover())
    return () => window.cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, compact, popoverAlign, hideCompare, draft.preset])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onReposition() {
      placePopover()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, compact, popoverAlign])

  function triggerLabel(): string {
    if (value.preset !== 'custom' && value.preset !== 'all') {
      return t(PRESET_LABEL[value.preset])
    }
    if (value.preset === 'all') return t('winAll')
    return formatDisplayRange(value.from, value.to)
  }

  function commit(next: DateRangeValue) {
    onChange(
      hideCompare ? { ...next, compare: 'off', compareFrom: undefined, compareTo: undefined } : next,
    )
    setOpen(false)
  }

  function pickPreset(preset: DateRangePreset) {
    // Draft only — Apply commits. Keeps popover open so summary + Von/Bis update live.
    setDraft(withResolvedPrimary(preset, { ...draft, preset }, dates))
  }

  function cancelDraft() {
    setDraft(value)
    setOpen(false)
  }

  function setCompare(mode: CompareMode) {
    setDraft((d) => {
      const primary = { from: d.from, to: d.to }
      if (mode === 'previous') {
        const p = previousPeriod(primary.from, primary.to)
        return { ...d, compare: mode, compareFrom: p.from, compareTo: p.to }
      }
      if (mode === 'previousYear') {
        const p = previousYear(primary.from, primary.to)
        return { ...d, compare: mode, compareFrom: p.from, compareTo: p.to }
      }
      if (mode === 'custom') {
        const p = previousPeriod(primary.from, primary.to)
        return {
          ...d,
          compare: mode,
          compareFrom: d.compareFrom || p.from,
          compareTo: d.compareTo || p.to,
        }
      }
      return { ...d, compare: 'off', compareFrom: undefined, compareTo: undefined }
    })
  }

  function applyDraft() {
    if (!isValidRange(draft.from, draft.to)) return
    if (draft.compare === 'custom') {
      if (!draft.compareFrom || !draft.compareTo || !isValidRange(draft.compareFrom, draft.compareTo)) {
        return
      }
    }
    const next = withResolvedPrimary(draft.preset, draft, dates)
    setDraft(next)
    commit(next)
  }

  const compareResolved = resolveCompareRange(
    draft.compare === 'off' ? draft : withResolvedPrimary(draft.preset, draft, dates),
  )

  const todayIso = formatIsoDate(new Date())
  const canApply =
    isValidRange(draft.from, draft.to) &&
    (draft.compare !== 'custom' ||
      (!!draft.compareFrom &&
        !!draft.compareTo &&
        isValidRange(draft.compareFrom, draft.compareTo)))

  const popover =
    open && popoverPos
      ? createPortal(
          <div
            ref={popoverRef}
            className={`funnel-dr-popover${compact ? ' funnel-dr-popover--compact' : ''}`.trim()}
            role="dialog"
            aria-labelledby={titleId}
            style={{
              position: 'fixed',
              top: popoverPos.top,
              left: popoverPos.left,
              width: popoverPos.width,
              right: 'auto',
              zIndex: 80,
            }}
          >
            <div className="funnel-dr-grid">
              <aside className="funnel-dr-presets" aria-label={t('timeWindow')}>
                <div className="funnel-dr-rail-title" id={titleId}>
                  {t('timeWindow')}
                </div>
                <div className="funnel-dr-rail-list" role="listbox">
                  {presets.map((p) => (
                    <button
                      key={p}
                      type="button"
                      role="option"
                      aria-selected={draft.preset === p}
                      className={`funnel-dr-preset${draft.preset === p ? ' is-active' : ''}`}
                      onClick={() => pickPreset(p)}
                    >
                      {t(PRESET_LABEL[p as Exclude<DateRangePreset, 'custom'>])}
                    </button>
                  ))}
                  <button
                    type="button"
                    role="option"
                    aria-selected={draft.preset === 'custom'}
                    className={`funnel-dr-preset${draft.preset === 'custom' ? ' is-active' : ''}`}
                    onClick={() => {
                      const r = rangeFromPreset('custom', {
                        customFrom: draft.from === 'all' ? undefined : draft.from,
                        customTo: draft.to === 'all' ? undefined : draft.to,
                      })
                      setDraft((d) => ({ ...d, preset: 'custom', from: r.from, to: r.to }))
                    }}
                  >
                    {t('winCustom')}
                  </button>
                </div>
              </aside>

              <div className="funnel-dr-panel">
                <div className="funnel-dr-summary" aria-live="polite">
                  <CalendarBlank size={16} weight="duotone" aria-hidden />
                  <span className="funnel-dr-summary-text">
                    <span className="funnel-dr-summary-today-lbl">{t('dateToday')}</span>
                    <span className="funnel-dr-summary-today-val">{formatDisplayDate(todayIso)}</span>
                  </span>
                  {draft.preset !== 'custom' ? (
                    <span className="funnel-dr-summary-badge">{t(PRESET_LABEL[draft.preset])}</span>
                  ) : null}
                </div>

                <div className="funnel-dr-dates">
                  <label className="funnel-dr-field">
                    <span className="funnel-dr-field-lbl">{t('dateFrom')}</span>
                    <input
                      type="date"
                      className="input funnel-dr-date"
                      value={draft.from === 'all' ? '' : draft.from}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, preset: 'custom', from: e.target.value }))
                      }
                    />
                  </label>
                  <span className="funnel-dr-date-sep" aria-hidden>
                    →
                  </span>
                  <label className="funnel-dr-field">
                    <span className="funnel-dr-field-lbl">{t('dateTo')}</span>
                    <input
                      type="date"
                      className="input funnel-dr-date"
                      value={draft.to === 'all' ? '' : draft.to}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, preset: 'custom', to: e.target.value }))
                      }
                    />
                  </label>
                </div>

                {!hideCompare ? (
                  <div className="funnel-dr-compare">
                    <button
                      type="button"
                      className={`funnel-dr-compare-switch${draft.compare !== 'off' ? ' is-on' : ''}`}
                      role="switch"
                      aria-checked={draft.compare !== 'off'}
                      onClick={() => setCompare(draft.compare === 'off' ? 'previous' : 'off')}
                    >
                      <span className="funnel-dr-compare-switch-track" aria-hidden>
                        <span className="funnel-dr-compare-switch-knob" />
                      </span>
                      <span className="funnel-dr-compare-switch-label">
                        <ArrowsLeftRight size={14} weight="bold" aria-hidden />
                        {t('dateCompare')}
                      </span>
                    </button>

                    {draft.compare !== 'off' ? (
                      <div className="funnel-dr-compare-body">
                        <div className="funnel-dr-seg" role="radiogroup" aria-label={t('dateCompare')}>
                          {(
                            [
                              ['previous', 'dateComparePrev'],
                              ['previousYear', 'dateCompareYear'],
                              ['custom', 'dateCompareCustom'],
                            ] as const
                          ).map(([mode, key]) => (
                            <button
                              key={mode}
                              type="button"
                              role="radio"
                              aria-checked={draft.compare === mode}
                              className={`funnel-dr-seg-btn${draft.compare === mode ? ' is-active' : ''}`}
                              onClick={() => setCompare(mode)}
                            >
                              {t(key)}
                            </button>
                          ))}
                        </div>

                        {draft.compare === 'custom' ? (
                          <div className="funnel-dr-dates funnel-dr-dates--cmp">
                            <label className="funnel-dr-field">
                              <span className="funnel-dr-field-lbl">{t('dateFrom')}</span>
                              <input
                                type="date"
                                className="input funnel-dr-date"
                                value={draft.compareFrom || ''}
                                onChange={(e) =>
                                  setDraft((d) => ({ ...d, compareFrom: e.target.value }))
                                }
                              />
                            </label>
                            <span className="funnel-dr-date-sep" aria-hidden>
                              →
                            </span>
                            <label className="funnel-dr-field">
                              <span className="funnel-dr-field-lbl">{t('dateTo')}</span>
                              <input
                                type="date"
                                className="input funnel-dr-date"
                                value={draft.compareTo || ''}
                                onChange={(e) =>
                                  setDraft((d) => ({ ...d, compareTo: e.target.value }))
                                }
                              />
                            </label>
                          </div>
                        ) : compareResolved ? (
                          <p className="funnel-dr-compare-hint">
                            {formatDisplayRange(compareResolved.from, compareResolved.to)}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="funnel-dr-actions">
              <button type="button" className="btn ghost" onClick={cancelDraft}>
                {t('dateRangeCancel')}
              </button>
              <button type="button" className="btn primary" disabled={!canApply} onClick={applyDraft}>
                {t('dateRangeApply')}
              </button>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div className={`funnel-filter-row funnel-dr ${className}`.trim()} ref={rootRef}>
      {showLabel ? (
        <span className="filter-lbl muted">
          <CalendarBlank className="filter-lbl-ic" size={14} weight="duotone" aria-hidden />
          {t('timeWindow')}
        </span>
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        className={`funnel-dr-trigger${open ? ' is-open' : ''}${!hideCompare && value.compare !== 'off' ? ' has-compare' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        aria-label={showLabel ? undefined : t('timeWindow')}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="funnel-dr-trigger-main">
          {!showLabel ? <CalendarBlank size={14} weight="duotone" aria-hidden /> : null}
          <span className="funnel-dr-trigger-label">{triggerLabel()}</span>
          {!hideCompare && value.compare !== 'off' ? (
            <span className="funnel-dr-vs">{t('dateCompareShort')}</span>
          ) : null}
        </span>
        <CaretDown size={12} weight="bold" className="funnel-dr-caret" aria-hidden />
      </button>
      {popover}
    </div>
  )
}
