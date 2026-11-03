/**
 * CreatePostNotes — Internal post notes panel (UI-only, local string).
 * Location: apps/web/src/components/create-post/CreatePostNotes.tsx
 */
import {
  ChatCircleText,
  ListBullets,
  TextB,
  TextItalic,
  TextUnderline,
  X,
} from '@phosphor-icons/react'
import { useI18n } from '../../lib/i18n'

type Props = {
  open: boolean
  notes: string
  onChange: (v: string) => void
  onClose: () => void
}

export function CreatePostNotes({ open, notes, onChange, onClose }: Props) {
  const { t } = useI18n()
  if (!open) return null

  return (
    <aside className="create-post-notes panel" aria-label={t('createPostNotesTitle')}>
      <div className="create-post-notes-head">
        <strong>{t('createPostNotesTitle')}</strong>
        <button type="button" className="btn icon-btn" onClick={onClose} aria-label={t('closeMenu')}>
          <X size={14} weight="bold" aria-hidden />
        </button>
      </div>

      {!notes.trim() ? (
        <div className="create-post-notes-empty muted">
          <ChatCircleText size={36} weight="duotone" aria-hidden />
          <p>{t('createPostNotesEmpty')}</p>
        </div>
      ) : (
        <p className="create-post-notes-body">{notes}</p>
      )}

      <div className="create-post-notes-editor">
        <div className="create-post-notes-tools" aria-hidden>
          <TextB size={14} weight="regular" />
          <TextItalic size={14} weight="regular" />
          <TextUnderline size={14} weight="regular" />
          <ListBullets size={14} weight="regular" />
        </div>
        <textarea
          className="textarea create-post-notes-input"
          value={notes}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('createPostNotesPh')}
          rows={3}
        />
      </div>
    </aside>
  )
}
