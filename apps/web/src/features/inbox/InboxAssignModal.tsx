/**
 * InboxAssignModal — pick a team member to assign the open conversation to.
 * Location: apps/web/src/features/inbox/InboxAssignModal.tsx
 */
import { createPortal } from 'react-dom'
import { User } from '@phosphor-icons/react'

export type AssignMember = {
  userId: string
  displayName: string | null
  email: string
}

type Props = {
  open: boolean
  busy?: boolean
  title: string
  noneLabel: string
  cancelLabel: string
  members: AssignMember[]
  selectedId: string | null
  onClose: () => void
  onAssign: (userId: string | null) => void
}

export function InboxAssignModal({
  open,
  busy = false,
  title,
  noneLabel,
  cancelLabel,
  members,
  selectedId,
  onClose,
  onAssign,
}: Props) {
  if (!open) return null

  return createPortal(
    <div
      className="bu-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inbox-assign-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        className="bu-modal panel inbox-assign-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="bu-modal-head">
          <h2 id="inbox-assign-title" className="section-title">
            {title}
          </h2>
        </header>
        <ul className="inbox-assign-list" role="listbox" aria-label={title}>
          <li>
            <button
              type="button"
              role="option"
              className={`inbox-assign-option${!selectedId ? ' is-on' : ''}`}
              aria-selected={!selectedId}
              disabled={busy}
              onClick={() => onAssign(null)}
            >
              <span className="inbox-assign-option-ic" aria-hidden>
                <User size={14} weight="regular" />
              </span>
              <span>{noneLabel}</span>
            </button>
          </li>
          {members.map((m) => {
            const on = selectedId === m.userId
            const label = m.displayName?.trim() || m.email
            return (
              <li key={m.userId}>
                <button
                  type="button"
                  role="option"
                  className={`inbox-assign-option${on ? ' is-on' : ''}`}
                  aria-selected={on}
                  disabled={busy}
                  onClick={() => onAssign(m.userId)}
                >
                  <span className="inbox-assign-option-ic" aria-hidden>
                    <User size={14} weight="bold" />
                  </span>
                  <span className="inbox-assign-option-text">
                    <span className="inbox-assign-option-name">{label}</span>
                    {m.displayName?.trim() ? (
                      <span className="muted inbox-assign-option-email">{m.email}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <footer className="bu-modal-actions">
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            {cancelLabel}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
