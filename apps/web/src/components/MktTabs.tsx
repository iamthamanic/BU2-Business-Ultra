/**
 * MktTabs — canonical Dark-Ops tab chrome for EVERY tab strip in the app
 * (Marketing, Settings, CRM detail, scope pickers). One segmented metaphor;
 * size/weight/spacing only via level. Optional Phosphor icons (decorative).
 * See docs/UI_STYLEGUIDE.md § Tablists. Location: apps/web/src/components/MktTabs.tsx
 */
import type { Icon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

export type MktTabsLevel = 'l1' | 'l2' | 'l3' | 'surface'

type TabsProps = {
  level: MktTabsLevel
  label: string
  children: ReactNode
  className?: string
}

export function MktTabs({ level, label, children, className }: TabsProps) {
  const extra = className ? ` ${className}` : ''
  return (
    <div
      className={`mkt-tabs mkt-tabs--${level}${extra}`}
      role="tablist"
      aria-label={label}
    >
      {children}
    </div>
  )
}

type TabProps = {
  active: boolean
  label: string
  onClick: () => void
  /** Decorative Phosphor glyph; label remains the accessible name */
  icon?: Icon
  /** Brand/accent key → CSS `--mkt-ic` via `[data-ic]` (sidebar parity) */
  dataIc?: string
}

const ICON_SIZE = 14

export function MktTab({ active, label, onClick, icon: Glyph, dataIc }: TabProps) {
  return (
    <button
      type="button"
      role="tab"
      className={`mkt-tab${active ? ' is-active' : ''}`}
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      data-ic={dataIc || undefined}
      onClick={onClick}
    >
      {Glyph ? (
        <span className="mkt-tab-ic" aria-hidden>
          <Glyph size={ICON_SIZE} weight="regular" />
        </span>
      ) : null}
      <span className="mkt-tab-label">{label}</span>
    </button>
  )
}
