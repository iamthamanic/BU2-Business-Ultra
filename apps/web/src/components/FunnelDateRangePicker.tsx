/**
 * FunnelDateRangePicker — Google-Ads-style period control with presets, custom from/to, and compare.
 * Location: apps/web/src/components/FunnelDateRangePicker.tsx
 */
import { useEffect, useId, useRef, useState } from 'react'
import { CalendarBlank, CaretDown } from '@phosphor-icons/react'
import { useI18n } from '../lib/i18n'
import type { MessageKey } from '../i18n/messages'
import {
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
  presets: DateRangePreset[]
  /** Optional known row dates for `all` span. */
  dates?: string[]
}

const PRESET_LABEL: Record<Exclude<DateRangePreset, 'custom'>, MessageKey> = {
  '24h': 'win24h',
  '7d': 'win7d',
  '30d': 'win30d',
  '90d': 'win90d',
  all: 'winAll',
}

export function FunnelDateRangePicker({ value, onChange, presets, dates }: Props) {
  const { t } = useI18n()
  const titleId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRangeValue>(value)

  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function triggerLabel(): string {
    if (value.preset !== 'custom' && value.preset !== 'all') {
      return t(PRESET_LABEL[value.preset])
    }
    if (value.preset === 'all') return t('winAll')
    return formatDisplayRange(value.from, value.to)
  }

  function pickPreset(preset: DateRangePreset) {
    const next = withResolvedPrimary(preset, { ...draft, preset }, dates)
    setDraft(next)
    onChange(next)
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

  function applyCustom() {
    if (!isValidRange(draft.from, draft.to)) return
    if (draft.compare === 'custom') {
      if (!draft.compareFrom || !draft.compareTo || !isValidRange(draft.compareFrom, draft.compareTo)) {
        return
      }
    }
    const next = withResolvedPrimary('custom', { ...draft, preset: 'custom' }, dates)
    onChange(next)
    setOpen(false)
  }

  const compareResolved = resolveCompareRange(
    draft.compare === 'off'
      ? draft
      : withResolvedPrimary(draft.preset, draft, dates),
  )

  return (
    <div className="funnel-filter-row funnel-dr" ref={rootRef}>
      <span className="filter-lbl muted">
        <CalendarBlank className="filter-lbl-ic" size={14} weight="duotone" aria-hidden />
        {t('timeWindow')}
      </span>
      <button
        type="button"
        className="funnel-dr-trigger chip"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="funnel-dr-trigger-label">{triggerLabel()}</span>
        {value.compare !== 'off' ? (
          <span className="funnel-dr-vs muted">{t('dateCompareShort')}</span>
        ) : null}
        <CaretDown size={12} weight="bold" aria-hidden />
      </button>

      {open ? (
        <div className="funnel-dr-popover" role="dialog" aria-labelledby={titleId} id={titleId}>
          <div className="funnel-dr-grid">
            <div className="funnel-dr-presets">
              <div className="funnel-dr-section-title">{t('timeWindow')}</div>
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`funnel-dr-preset${draft.preset === p ? ' is-active' : ''}`}
                  onClick={() => pickPreset(p)}
                >
                  {t(PRESET_LABEL[p as Exclude<DateRangePreset, 'custom'>])}
                </button>
              ))}
              <button
                type="button"
                className={`funnel-dr-preset${draft.preset === 'custom' ? ' is-active' : ''}`}
                onClick={() => {
                  const r = rangeFromPreset('custom', {
                    customFrom: draft.from,
                    customTo: draft.to,
                  })
                  setDraft((d) => ({ ...d, preset: 'custom', from: r.from, to: r.to }))
                }}
              >
                {t('winCustom')}
              </button>
            </div>

            <div className="funnel-dr-custom">
              <div className="funnel-dr-section-title">{t('winCustom')}</div>
              <label className="funnel-dr-field">
                <span className="label">{t('dateFrom')}</span>
                <input
                  type="date"
                  className="input"
                  value={draft.from === 'all' ? '' : draft.from}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, preset: 'custom', from: e.target.value }))
                  }
                />
              </label>
              <label className="funnel-dr-field">
                <span className="label">{t('dateTo')}</span>
                <input
                  type="date"
                  className="input"
                  value={draft.to === 'all' ? '' : draft.to}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, preset: 'custom', to: e.target.value }))
                  }
                />
              </label>

              <label className="funnel-dr-compare-toggle">
                <input
                  type="checkbox"
                  checked={draft.compare !== 'off'}
                  onChange={(e) => setCompare(e.target.checked ? 'previous' : 'off')}
                />
                <span>{t('dateCompare')}</span>
              </label>

              {draft.compare !== 'off' ? (
                <div className="funnel-dr-compare-modes">
                  {(
                    [
                      ['previous', 'dateComparePrev'],
                      ['previousYear', 'dateCompareYear'],
                      ['custom', 'dateCompareCustom'],
                    ] as const
                  ).map(([mode, key]) => (
                    <label key={mode} className="funnel-dr-compare-mode">
                      <input
                        type="radio"
                        name="funnel-dr-compare"
                        checked={draft.compare === mode}
                        onChange={() => setCompare(mode)}
                      />
                      <span>{t(key)}</span>
                    </label>
                  ))}
                  {draft.compare === 'custom' ? (
                    <>
                      <label className="funnel-dr-field">
                        <span className="label">{t('dateFrom')}</span>
                        <input
                          type="date"
                          className="input"
                          value={draft.compareFrom || ''}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, compareFrom: e.target.value }))
                          }
                        />
                      </label>
                      <label className="funnel-dr-field">
                        <span className="label">{t('dateTo')}</span>
                        <input
                          type="date"
                          className="input"
                          value={draft.compareTo || ''}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, compareTo: e.target.value }))
                          }
                        />
                      </label>
                    </>
                  ) : compareResolved ? (
                    <p className="muted funnel-dr-compare-hint">
                      {formatDisplayRange(compareResolved.from, compareResolved.to)}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="funnel-dr-actions">
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              {t('dateRangeCancel')}
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={!isValidRange(draft.from, draft.to)}
              onClick={applyCustom}
            >
              {t('dateRangeApply')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
