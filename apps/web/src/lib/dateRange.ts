/**
 * dateRange — Funnel date-range + compare helpers (Google-Ads-style).
 * Location: apps/web/src/lib/dateRange.ts
 */
import { formatIsoDate, windowToDateRange } from './funnelExport'

export type DateRangePreset = '24h' | '7d' | '30d' | '90d' | 'all' | 'custom'
export type CompareMode = 'off' | 'previous' | 'previousYear' | 'custom'

export type DateRangeValue = {
  preset: DateRangePreset
  from: string
  to: string
  compare: CompareMode
  compareFrom?: string
  compareTo?: string
}

export const ORGANIC_PRESETS: DateRangePreset[] = ['24h', '7d', '30d', 'all']
export const PAID_PRESETS: DateRangePreset[] = ['7d', '30d', '90d', 'all']
export const CUSTOM_PRESETS: DateRangePreset[] = ['24h', '7d', '30d', 'all']

export function defaultDateRange(preset: DateRangePreset = '30d'): DateRangeValue {
  const { from, to } = windowToDateRange(preset === 'custom' ? '30d' : preset)
  return { preset: preset === 'custom' ? '30d' : preset, from, to, compare: 'off' }
}

export function rangeFromPreset(
  preset: DateRangePreset,
  opts?: { dates?: string[]; customFrom?: string; customTo?: string },
): { from: string; to: string } {
  if (preset === 'custom') {
    const from = opts?.customFrom || formatIsoDate(new Date())
    const to = opts?.customTo || from
    return { from, to }
  }
  return windowToDateRange(preset, { dates: opts?.dates })
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y!, (m || 1) - 1, d || 1)
}

function daysInclusive(from: string, to: string): number {
  const a = parseIso(from).getTime()
  const b = parseIso(to).getTime()
  return Math.max(1, Math.round((b - a) / 86400000) + 1)
}

/** Same-length window immediately before `from`. */
export function previousPeriod(from: string, to: string): { from: string; to: string } {
  const len = daysInclusive(from, to)
  const end = parseIso(from)
  end.setDate(end.getDate() - 1)
  const start = new Date(end)
  start.setDate(start.getDate() - (len - 1))
  return { from: formatIsoDate(start), to: formatIsoDate(end) }
}

/** Same calendar window shifted −1 year. */
export function previousYear(from: string, to: string): { from: string; to: string } {
  const a = parseIso(from)
  const b = parseIso(to)
  a.setFullYear(a.getFullYear() - 1)
  b.setFullYear(b.getFullYear() - 1)
  return { from: formatIsoDate(a), to: formatIsoDate(b) }
}

export function resolveCompareRange(
  value: DateRangeValue,
): { from: string; to: string } | null {
  if (value.compare === 'off') return null
  if (value.compare === 'previous') return previousPeriod(value.from, value.to)
  if (value.compare === 'previousYear') return previousYear(value.from, value.to)
  if (value.compare === 'custom' && value.compareFrom && value.compareTo) {
    return { from: value.compareFrom, to: value.compareTo }
  }
  return null
}

export function isValidRange(from: string, to: string): boolean {
  if (!from || !to || from.length < 10 || to.length < 10) return false
  if (from === 'all' || to === 'all') return true
  return from <= to
}

/** Inclusive date filter; `all`/`all` passes everything with a date. */
export function dateInRange(isoDate: string | null | undefined, from: string, to: string): boolean {
  if (!isoDate || isoDate.length < 10) return false
  const d = isoDate.slice(0, 10)
  if (from === 'all' && to === 'all') return true
  return d >= from && d <= to
}

export function formatDisplayRange(from: string, to: string): string {
  if (from === 'all' || to === 'all') return 'Alle'
  return `${fmtDe(from)} – ${fmtDe(to)}`
}

function fmtDe(iso: string): string {
  if (!iso || iso.length < 10) return iso
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`
}

export function pctDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / Math.abs(previous)) * 100
}

export function formatPctDelta(delta: number | null): string {
  if (delta == null || !Number.isFinite(delta)) return '—'
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)}%`
}

export function withResolvedPrimary(
  preset: DateRangePreset,
  draft: Partial<DateRangeValue>,
  dates?: string[],
): DateRangeValue {
  const base = rangeFromPreset(preset, {
    dates,
    customFrom: draft.from,
    customTo: draft.to,
  })
  const compare = draft.compare ?? 'off'
  let compareFrom = draft.compareFrom
  let compareTo = draft.compareTo
  if (compare === 'previous') {
    const p = previousPeriod(base.from, base.to)
    compareFrom = p.from
    compareTo = p.to
  } else if (compare === 'previousYear') {
    const p = previousYear(base.from, base.to)
    compareFrom = p.from
    compareTo = p.to
  }
  return {
    preset,
    from: base.from,
    to: base.to,
    compare,
    compareFrom,
    compareTo,
  }
}
