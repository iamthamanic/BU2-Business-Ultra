/**
 * InboxChannelFilter — header dropdown to toggle which connected channels appear in the list.
 * Location: apps/web/src/features/inbox/InboxChannelFilter.tsx
 */
import { useEffect, useId, useRef, useState } from 'react'
import { CaretDown, Faders } from '@phosphor-icons/react'
import { ConnBrandLogo } from '../settings/connBrandLogos'
import { inboxLogoId } from './inboxChannel'

export type InboxChannelFilterConnection = {
  id: string
  provider: string
  displayName: string | null
  externalAccountId: string
}

type Props = {
  connections: InboxChannelFilterConnection[]
  enabledIds: string[]
  onChange: (next: string[]) => void
  label: string
  emptyLabel: string
  allLabel: string
}

export function InboxChannelFilter({
  connections,
  enabledIds,
  onChange,
  label,
  emptyLabel,
  allLabel,
}: Props) {
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const enabled = new Set(enabledIds)
  const allOn = connections.length > 0 && connections.every((c) => enabled.has(c.id))
  const partial = enabledIds.length > 0 && !allOn

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

  function toggle(id: string) {
    if (enabled.has(id)) onChange(enabledIds.filter((x) => x !== id))
    else onChange([...enabledIds, id])
  }

  function toggleAll() {
    if (allOn) onChange([])
    else onChange(connections.map((c) => c.id))
  }

  return (
    <div ref={rootRef} className={`inbox-channel-filter${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className={`btn icon-btn inbox-channel-filter-trigger${partial ? ' is-active' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        title={label}
        onClick={() => setOpen((v) => !v)}
      >
        <Faders size={16} weight="bold" aria-hidden />
        {partial ? (
          <span className="inbox-channel-filter-badge" aria-hidden>
            {enabledIds.length}
          </span>
        ) : null}
        <CaretDown size={10} weight="bold" aria-hidden className="inbox-channel-filter-caret" />
      </button>

      {open ? (
        <div id={menuId} className="inbox-channel-menu" role="menu" aria-label={label}>
          <div className="inbox-channel-menu-head">{label}</div>
          {connections.length === 0 ? (
            <p className="muted inbox-channel-menu-empty">{emptyLabel}</p>
          ) : (
            <ul className="inbox-channel-menu-list">
              <li>
                <label className={`inbox-channel-option${allOn ? ' is-on' : ''}`}>
                  <input type="checkbox" checked={allOn} onChange={toggleAll} />
                  <span className="inbox-channel-option-label">{allLabel}</span>
                </label>
              </li>
              {connections.map((c) => {
                const on = enabled.has(c.id)
                const name = c.displayName?.trim() || c.externalAccountId || c.provider
                return (
                  <li key={c.id}>
                    <label className={`inbox-channel-option${on ? ' is-on' : ''}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(c.id)} />
                      <span className="inbox-channel-option-icon">
                        <ConnBrandLogo id={inboxLogoId(null, c.provider)} size="sm" />
                      </span>
                      <span className="inbox-channel-option-text">
                        <span className="inbox-channel-option-label">{name}</span>
                        <span className="inbox-channel-option-meta">{c.provider}</span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
