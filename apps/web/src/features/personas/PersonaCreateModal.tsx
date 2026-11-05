/**
 * PersonaCreateModal — create a marketing persona (name + summary).
 * Location: apps/web/src/features/personas/PersonaCreateModal.tsx
 */
import { useState } from 'react'
import { UserFocus } from '@phosphor-icons/react'
import { useI18n } from '../../lib/i18n'

type Props = {
  open: boolean
  busy?: boolean
  onClose: () => void
  onSave: (body: { name: string; summary?: string }) => Promise<void>
}

export function PersonaCreateModal({ open, busy, onClose, onSave }: Props) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setErr(t('personaNameRequired'))
      return
    }
    setSaving(true)
    setErr('')
    try {
      await onSave({
        name: name.trim(),
        summary: summary.trim() || undefined,
      })
      setName('')
      setSummary('')
      onClose()
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const blocked = saving || busy

  return (
    <div
      className="bu-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="persona-create-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !blocked) onClose()
      }}
    >
      <form
        className="bu-modal panel stack persona-create-modal"
        onSubmit={(e) => void submit(e)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="bu-modal-head">
          <div className="persona-create-modal-title-row">
            <UserFocus size={18} weight="duotone" aria-hidden />
            <h2 id="persona-create-title" className="section-title" style={{ margin: 0 }}>
              {t('personaCreate')}
            </h2>
          </div>
        </header>

        {err ? (
          <p className="error" role="alert">
            {err}
          </p>
        ) : null}

        <label className="field">
          <span className="label">{t('name')}</span>
          <input
            className="input"
            autoFocus
            value={name}
            disabled={blocked}
            placeholder={t('personaNamePh')}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="label">{t('personaSummary')}</span>
          <input
            className="input"
            value={summary}
            disabled={blocked}
            placeholder={t('personaSummaryPh')}
            onChange={(e) => setSummary(e.target.value)}
          />
        </label>

        <footer className="bu-modal-actions">
          <button type="button" className="btn" disabled={blocked} onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn primary" disabled={blocked || !name.trim()}>
            {blocked ? '…' : t('personaCreate')}
          </button>
        </footer>
      </form>
    </div>
  )
}
