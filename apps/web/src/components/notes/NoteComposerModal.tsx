/**
 * NoteComposerModal — shared note create dialog (footer Cancel only; no header X).
 * Location: apps/web/src/components/notes/NoteComposerModal.tsx
 */
import { createPortal } from 'react-dom'
import { Plus } from '@phosphor-icons/react'
import { useI18n } from '../../lib/i18n'
import { NoteEditor } from './NoteEditor'

type Props = {
  open: boolean
  title: string
  placeholder: string
  submitLabel: string
  body: string
  onBodyChange: (html: string) => void
  canSubmit: boolean
  busy?: boolean
  error?: string | null
  onClose: () => void
  onSubmit: () => void
  rows?: number
}

export function NoteComposerModal({
  open,
  title,
  placeholder,
  submitLabel,
  body,
  onBodyChange,
  canSubmit,
  busy = false,
  error,
  onClose,
  onSubmit,
  rows = 5,
}: Props) {
  const { t } = useI18n()
  if (!open) return null

  return createPortal(
    <div
      className="bu-modal-overlay note-composer-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-composer-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        className="bu-modal panel stack note-composer-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="bu-modal-head">
          <h2
            id="note-composer-title"
            className="section-title"
            style={{ margin: 0, fontSize: '1.1rem' }}
          >
            {title}
          </h2>
        </header>
        <div className="stack" style={{ gap: 10 }}>
          <NoteEditor
            value={body}
            onChange={onBodyChange}
            disabled={busy}
            placeholder={placeholder}
            rows={rows}
            autoFocus
          />
          {error ? (
            <p className="error" style={{ margin: 0, fontSize: 12 }}>
              {error}
            </p>
          ) : null}
        </div>
        <footer className="bu-modal-actions">
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!canSubmit}
            onClick={() => void onSubmit()}
          >
            <Plus size={14} weight="bold" aria-hidden />
            {busy ? t('loading') : submitLabel}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
