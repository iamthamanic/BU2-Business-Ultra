/**
 * NoteThread — reusable comment/note list; composer opens in a modal (not inline).
 * Location: apps/web/src/components/notes/NoteThread.tsx
 */
import { useState } from 'react'
import { ChatCircle, Plus } from '@phosphor-icons/react'
import { NoteCard } from './NoteCard'
import { NoteComposerModal } from './NoteComposerModal'
import type { ThreadNote } from './noteUtils'
import { useNoteComposer } from './useNoteComposer'

type Props = {
  notes: ThreadNote[]
  canWrite: boolean
  title: string
  emptyLabel: string
  placeholder: string
  addLabel: string
  unknownAuthorLabel: string
  onAdd: (body: string) => Promise<void>
  compact?: boolean
}

export function NoteThread({
  notes,
  canWrite,
  title,
  emptyLabel,
  placeholder,
  addLabel,
  unknownAuthorLabel,
  onAdd,
  compact = true,
}: Props) {
  const [composerOpen, setComposerOpen] = useState(false)
  const composer = useNoteComposer({
    onSubmit: async (body) => {
      await onAdd(body)
      setComposerOpen(false)
    },
  })

  function openComposer() {
    composer.setBody('')
    setComposerOpen(true)
  }

  return (
    <section className={`note-thread${compact ? ' note-thread--compact' : ''}`}>
      <header className="note-thread-head">
        <h3 className="note-thread-title">{title}</h3>
        <span className="muted note-thread-count">{notes.length}</span>
        {canWrite && notes.length > 0 ? (
          <button type="button" className="btn" onClick={openComposer}>
            <Plus size={14} weight="bold" aria-hidden />
            {addLabel}
          </button>
        ) : null}
      </header>

      {notes.length === 0 ? (
        <div className="customer-empty-block note-thread-empty">
          <ChatCircle size={22} weight="regular" aria-hidden />
          <p className="muted" style={{ margin: 0 }}>
            {emptyLabel}
          </p>
          {canWrite ? (
            <button type="button" className="btn primary" onClick={openComposer}>
              <Plus size={14} weight="bold" aria-hidden />
              {addLabel}
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="customer-note-list">
          {notes.map((n) => (
            <NoteCard key={n.id} note={n} authorFallback={unknownAuthorLabel} />
          ))}
        </ul>
      )}

      <NoteComposerModal
        open={composerOpen}
        title={title}
        placeholder={placeholder}
        submitLabel={addLabel}
        body={composer.body}
        onBodyChange={composer.setBody}
        canSubmit={composer.canSubmit}
        busy={composer.busy}
        error={composer.error}
        onClose={() => setComposerOpen(false)}
        onSubmit={() => void composer.submit()}
        rows={compact ? 4 : 5}
      />
    </section>
  )
}
