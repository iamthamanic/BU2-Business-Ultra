/**
 * TableColumnsModal — checkbox picker for table column visibility.
 * Location: apps/web/src/components/TableColumnsModal.tsx
 */
import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import type { TableColumnDef } from '../lib/tableColumns'
import { FunnelTip } from './FunnelTip'

type Props = {
  open: boolean
  title: string
  columns: TableColumnDef[]
  visibleKeys: string[]
  lockedHint: string
  cancelLabel: string
  resetLabel: string
  applyLabel: string
  onClose: () => void
  onApply: (keys: string[]) => void
  onReset: () => void
}

export function TableColumnsModal({
  open,
  title,
  columns,
  visibleKeys,
  lockedHint,
  cancelLabel,
  resetLabel,
  applyLabel,
  onClose,
  onApply,
  onReset,
}: Props) {
  const titleId = useId()
  const [draft, setDraft] = useState<string[]>(visibleKeys)

  useEffect(() => {
    if (open) setDraft(visibleKeys)
  }, [open, visibleKeys])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function toggle(key: string, locked?: boolean) {
    if (locked) return
    setDraft((prev) => {
      if (prev.includes(key)) {
        const next = prev.filter((k) => k !== key)
        return next.length === 0 ? prev : next
      }
      const order = columns.map((c) => c.key)
      return order.filter((k) => k === key || prev.includes(k))
    })
  }

  return createPortal(
    <div
      className="bu-modal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="bu-modal panel table-columns-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="bu-modal-head">
          <h2 id={titleId} className="section-title" style={{ margin: 0 }}>
            {title}
          </h2>
          <button
            type="button"
            className="btn icon-btn"
            onClick={onClose}
            aria-label={cancelLabel}
          >
            <X size={16} weight="bold" aria-hidden />
          </button>
        </header>

        <ul className="table-columns-list">
          {columns.map((c) => {
            const on = draft.includes(c.key)
            return (
              <li key={c.key}>
                <label
                  className={`table-columns-option${on ? ' is-on' : ''}${c.locked ? ' is-locked' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={Boolean(c.locked)}
                    onChange={() => toggle(c.key, c.locked)}
                  />
                  <span className="table-columns-option-main">
                    <span className="table-columns-option-label">{c.label}</span>
                    {c.locked ? (
                      <span className="muted table-columns-locked">{lockedHint}</span>
                    ) : null}
                  </span>
                  {c.description ? (
                    <span
                      className="table-columns-option-tip"
                      onClick={(e) => e.preventDefault()}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <FunnelTip tip={c.description} iconOnly wide>
                        {c.label}
                      </FunnelTip>
                    </span>
                  ) : null}
                </label>
              </li>
            )
          })}
        </ul>

        <footer className="bu-modal-actions table-columns-actions">
          <button
            type="button"
            className="btn"
            onClick={() => {
              onReset()
              setDraft(columns.map((c) => c.key))
            }}
          >
            {resetLabel}
          </button>
          <span className="table-columns-actions-spacer" />
          <button type="button" className="btn" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              onApply(draft)
              onClose()
            }}
          >
            {applyLabel}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
