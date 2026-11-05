/**
 * ArchiveSegmentToggle — Dark-Ops segmented control (active/archived or generic options).
 * Location: apps/web/src/components/ArchiveSegmentToggle.tsx
 */
import type { ReactNode } from 'react'

export type ArchiveSegmentOption<T extends string> = {
  value: T
  label: ReactNode
  /** Optional modifier: active | archived (status color) */
  tone?: 'active' | 'archived'
  className?: string
}

type Props<T extends string> = {
  value: T
  options: ArchiveSegmentOption<T>[]
  onChange: (value: T) => void
  label: string
  className?: string
}

export function ArchiveSegmentToggle<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: Props<T>) {
  const extra = className ? ` ${className}` : ''
  return (
    <div className={`product-archive-toggle${extra}`} role="group" aria-label={label}>
      {options.map((opt) => {
        const on = value === opt.value
        const tone =
          opt.tone === 'active'
            ? ' archive-seg--active'
            : opt.tone === 'archived'
              ? ' archive-seg--archived'
              : ''
        const custom = opt.className ? ` ${opt.className}` : ''
        return (
          <button
            key={opt.value}
            type="button"
            className={`archive-seg${tone}${custom}${on ? ' is-on' : ''}`}
            aria-pressed={on}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
