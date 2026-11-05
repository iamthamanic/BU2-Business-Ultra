/**
 * NoteCard — shared Kunden-note chrome (body + author meta).
 * Location: apps/web/src/components/notes/NoteCard.tsx
 */
import type { ReactNode } from 'react'
import { NoteBodyHtml } from './NoteEditor'
import { formatNoteWhen, noteInitials, type ThreadNote } from './noteUtils'

type Props = {
  note: ThreadNote
  authorFallback: string
  editedLabel?: string
  reply?: boolean
  /** Replace body (e.g. inline editor). */
  bodySlot?: ReactNode
  /** Top-right actions (⋮ menu). */
  actions?: ReactNode
  /** Extra footer (reply button). */
  footerExtra?: ReactNode
}

export function NoteCard({
  note,
  authorFallback,
  editedLabel,
  reply,
  bodySlot,
  actions,
  footerExtra,
}: Props) {
  const author = note.authorDisplayName?.trim() || authorFallback
  const edited =
    Boolean(editedLabel) &&
    note.updatedAt &&
    note.createdAt &&
    new Date(note.updatedAt).getTime() - new Date(note.createdAt).getTime() > 1000

  return (
    <li className={`customer-note-card${reply ? ' is-reply' : ''}`}>
      {bodySlot ? (
        bodySlot
      ) : (
        <div className="customer-note-main">
          <NoteBodyHtml body={note.body} />
          {actions ? <div className="customer-note-actions">{actions}</div> : null}
        </div>
      )}
      <footer className="customer-note-meta">
        <div className="customer-note-author">
          <span className="customer-note-av" aria-hidden>
            {noteInitials(author)}
          </span>
          <div className="customer-note-author-text">
            <span className="customer-note-author-name">{author}</span>
            <span className="muted customer-note-when">
              {formatNoteWhen(note.createdAt)}
              {edited ? ` · ${editedLabel}` : ''}
            </span>
          </div>
        </div>
        {footerExtra}
      </footer>
    </li>
  )
}
