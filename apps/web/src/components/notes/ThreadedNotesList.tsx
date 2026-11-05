/**
 * ThreadedNotesList — CRM-style note tree with edit / reply / ⋮ actions via NoteCard.
 * Location: apps/web/src/components/notes/ThreadedNotesList.tsx
 */
import { ArrowBendUpLeft, DotsThree } from '@phosphor-icons/react'
import { useI18n } from '../../lib/i18n'
import { NoteCard } from './NoteCard'
import { NoteEditor, notePlainText } from './NoteEditor'
import type { ThreadNote } from './noteUtils'

export type NoteThreadGroup = {
  root: ThreadNote
  replies: ThreadNote[]
}

type Props = {
  threads: NoteThreadGroup[]
  canWrite: boolean
  editingNoteId: string | null
  editingNoteBody: string
  noteBusyId: string | null
  noteMenuId: string | null
  replyParentId: string | null
  replyBody: string
  replyBusy: boolean
  onEditBodyChange: (html: string) => void
  onCancelEdit: () => void
  onSaveEdit: (noteId: string) => void
  onOpenMenu: (noteId: string, anchor: HTMLElement) => void
  onStartReply: (note: ThreadNote) => void
  onReplyBodyChange: (html: string) => void
  onCancelReply: () => void
  onSubmitReply: () => void
}

export function ThreadedNotesList({
  threads,
  canWrite,
  editingNoteId,
  editingNoteBody,
  noteBusyId,
  noteMenuId,
  replyParentId,
  replyBody,
  replyBusy,
  onEditBodyChange,
  onCancelEdit,
  onSaveEdit,
  onOpenMenu,
  onStartReply,
  onReplyBodyChange,
  onCancelReply,
  onSubmitReply,
}: Props) {
  const { t } = useI18n()
  const unknown = t('customerNoteAuthorUnknown')

  function renderCard(n: ThreadNote, opts?: { reply?: boolean }) {
    const isEditing = editingNoteId === n.id
    const busy = noteBusyId === n.id

    return (
      <NoteCard
        key={n.id}
        note={n}
        authorFallback={unknown}
        editedLabel={t('customerNoteEdited')}
        reply={opts?.reply}
        bodySlot={
          isEditing ? (
            <div className="customer-note-edit">
              <NoteEditor
                key={n.id}
                value={editingNoteBody}
                onChange={onEditBodyChange}
                disabled={busy}
                placeholder={t('customerNotePh')}
                autoFocus
                rows={4}
              />
              <div className="customer-note-edit-actions">
                <button type="button" className="btn" disabled={busy} onClick={onCancelEdit}>
                  {t('customerNoteCancel')}
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy || !notePlainText(editingNoteBody)}
                  onClick={() => onSaveEdit(n.id)}
                >
                  {t('customerNoteSave')}
                </button>
              </div>
            </div>
          ) : undefined
        }
        actions={
          canWrite && !isEditing ? (
            <button
              type="button"
              className="btn icon-btn customer-note-menu-btn"
              disabled={busy}
              aria-label={t('customerNoteMenu')}
              title={t('customerNoteMenu')}
              aria-haspopup="menu"
              aria-expanded={noteMenuId === n.id}
              onClick={(e) => {
                e.stopPropagation()
                onOpenMenu(n.id, e.currentTarget)
              }}
            >
              <DotsThree size={14} weight="bold" aria-hidden />
            </button>
          ) : null
        }
        footerExtra={
          canWrite && !isEditing ? (
            <button
              type="button"
              className="btn customer-note-reply-btn"
              disabled={busy || replyBusy}
              onClick={() => onStartReply(n)}
            >
              <ArrowBendUpLeft size={12} weight="bold" aria-hidden />
              {t('customerNoteReply')}
            </button>
          ) : null
        }
      />
    )
  }

  return (
    <ul className="customer-note-list">
      {threads.map(({ root, replies }) => (
        <li key={root.id} className="customer-note-thread">
          <ul className="customer-note-thread-list">
            {renderCard(root)}
            {replies.map((r) => renderCard(r, { reply: true }))}
            {replyParentId === root.id ? (
              <li className="customer-note-card customer-note-reply-composer is-reply">
                <NoteEditor
                  key={`reply-${root.id}`}
                  value={replyBody}
                  onChange={onReplyBodyChange}
                  disabled={replyBusy}
                  placeholder={t('customerNoteReplyPh')}
                  autoFocus
                  rows={3}
                />
                <div className="customer-note-edit-actions">
                  <button type="button" className="btn" disabled={replyBusy} onClick={onCancelReply}>
                    {t('customerNoteCancel')}
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={replyBusy || !notePlainText(replyBody)}
                    onClick={() => onSubmitReply()}
                  >
                    {t('customerNoteReplySave')}
                  </button>
                </div>
              </li>
            ) : null}
          </ul>
        </li>
      ))}
    </ul>
  )
}
