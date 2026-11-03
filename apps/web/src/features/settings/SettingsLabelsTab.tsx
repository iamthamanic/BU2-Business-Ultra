/**
 * SettingsLabelsTab — company labels by scope (customer / project / marketing / product).
 * Scannable rows with explicit edit expand; create via modal.
 * Location: apps/web/src/features/settings/SettingsLabelsTab.tsx
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  FolderSimple,
  Megaphone,
  Package,
  PencilSimple,
  Trash,
  User,
  X,
} from '@phosphor-icons/react'
import type { BusinessLabelScope } from '@bu2/shared'
import { MktTab, MktTabs } from '../../components/MktTabs'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { MessageKey } from '../../i18n/messages'

export type BusinessLabel = {
  id: string
  scope: BusinessLabelScope
  name: string
  color: string | null
  description?: string
  createdByUserId?: string | null
  createdByDisplayName?: string | null
  createdAt: string
}

const TAG_COLORS = ['#ec4899', '#3d8bfd', '#22c55e', '#f59e0b', '#ef4444', '#8b98a8', '#a78bfa']

const SCOPES: {
  id: BusinessLabelScope
  labelKey: MessageKey
  icon: typeof User
}[] = [
  { id: 'customer', labelKey: 'settingsLabelsCustomer', icon: User },
  { id: 'project', labelKey: 'settingsLabelsProject', icon: FolderSimple },
  { id: 'marketing', labelKey: 'settingsLabelsMarketing', icon: Megaphone },
  { id: 'product', labelKey: 'settingsLabelsProduct', icon: Package },
]

function formatLabelWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Props = { slug: string }

type EditDraft = {
  id: string
  name: string
  description: string
  color: string | null
}

export function SettingsLabelsTab({ slug }: Props) {
  const { t } = useI18n()
  const [scope, setScope] = useState<BusinessLabelScope>('customer')
  const [labels, setLabels] = useState<BusinessLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState<string>(TAG_COLORS[0]!)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [draft, setDraft] = useState<EditDraft | null>(null)

  async function refresh(nextScope = scope) {
    setLoading(true)
    try {
      const r = await api<{ labels: BusinessLabel[]; tags?: BusinessLabel[] }>(
        `/api/b/${slug}/labels?scope=${encodeURIComponent(nextScope)}`,
      )
      setLabels(r.labels || r.tags || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh(scope).catch((e) => {
      setMsg(String(e))
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, scope])

  useEffect(() => {
    if (!createOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) closeCreate()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [createOpen, busy])

  useEffect(() => {
    if (!draft || createOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) setDraft(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draft, createOpen, busy])

  function openCreate() {
    setDraft(null)
    setName('')
    setDescription('')
    setColor(TAG_COLORS[0]!)
    setMsg('')
    setCreateOpen(true)
  }

  function closeCreate() {
    if (busy) return
    setCreateOpen(false)
    setName('')
    setDescription('')
    setMsg('')
  }

  function openEdit(label: BusinessLabel) {
    setMsg('')
    setDraft({
      id: label.id,
      name: label.name,
      description: label.description || '',
      color: label.color,
    })
  }

  function closeEdit() {
    if (busy) return
    setDraft(null)
  }

  async function createLabel() {
    const n = name.trim()
    if (!n || busy) return
    setBusy(true)
    setMsg('')
    try {
      await api(`/api/b/${slug}/labels`, {
        method: 'POST',
        body: JSON.stringify({
          name: n,
          color,
          scope,
          description: description.trim(),
        }),
      })
      setCreateOpen(false)
      setName('')
      setDescription('')
      await refresh()
    } catch (e) {
      setMsg(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit() {
    if (!draft || busy) return
    const n = draft.name.trim()
    if (!n) return
    setBusy(true)
    setMsg('')
    try {
      await api(`/api/b/${slug}/labels/${draft.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: n,
          description: draft.description.trim(),
          color: draft.color,
        }),
      })
      setDraft(null)
      await refresh()
    } catch (e) {
      setMsg(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function removeLabel(id: string) {
    if (!confirm(t('settingsLabelsDeleteConfirm'))) return
    setBusy(true)
    setMsg('')
    try {
      await api(`/api/b/${slug}/labels/${id}`, { method: 'DELETE' })
      if (draft?.id === id) setDraft(null)
      await refresh()
    } catch (e) {
      setMsg(String(e))
    } finally {
      setBusy(false)
    }
  }

  function ColorDots({
    value,
    onPick,
    disabled,
  }: {
    value: string | null
    onPick: (c: string) => void
    disabled?: boolean
  }) {
    return (
      <div className="co-tag-colors" role="group" aria-label={t('settingsLabelsColor')}>
        {TAG_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`co-tag-color${value === c ? ' is-on' : ''}`}
            style={{ background: c }}
            disabled={disabled}
            aria-label={c}
            aria-pressed={value === c}
            onClick={() => onPick(c)}
          />
        ))}
      </div>
    )
  }

  function chipStyle(c: string | null | undefined): CSSProperties | undefined {
    if (!c) return undefined
    return {
      borderColor: `color-mix(in srgb, ${c} 45%, var(--border))`,
      background: `color-mix(in srgb, ${c} 16%, var(--panel2))`,
      color: c,
    }
  }

  return (
    <section className="panel stack">
      <div className="co-card-head">
        <div>
          <h3 className="co-card-title">{t('settingsLabels')}</h3>
          <p className="muted co-card-hint">{t('settingsLabelsHint')}</p>
        </div>
        <button type="button" className="btn primary" disabled={busy} onClick={openCreate}>
          {t('settingsLabelsAddShort')}
        </button>
      </div>

      <MktTabs level="surface" label={t('settingsLabels')} className="co-settings-scope-tabs">
        {SCOPES.map((s) => (
          <MktTab
            key={s.id}
            active={scope === s.id}
            label={t(s.labelKey)}
            icon={s.icon}
            onClick={() => {
              setScope(s.id)
              setDraft(null)
              setMsg('')
            }}
          />
        ))}
      </MktTabs>

      {loading ? (
        <p className="muted">{t('loading')}</p>
      ) : labels.length === 0 ? (
        <div className="co-tag-empty">
          <p className="muted">{t('settingsLabelsEmpty')}</p>
          <button type="button" className="btn primary" disabled={busy} onClick={openCreate}>
            {t('settingsLabelsAdd')}
          </button>
        </div>
      ) : (
        <ul className="co-tag-list">
          {labels.map((label) => {
            const author =
              label.createdByDisplayName?.trim() || t('settingsLabelsAuthorUnknown')
            const when = formatLabelWhen(label.createdAt)
            const desc = (label.description || '').trim()
            const isEditing = draft?.id === label.id
            const accent = isEditing ? draft.color : label.color

            return (
              <li
                key={label.id}
                className={`co-tag-card${isEditing ? ' is-editing' : ''}`}
                style={
                  accent
                    ? ({ '--co-tag-accent': accent } as CSSProperties)
                    : undefined
                }
              >
                <div className={`co-tag-card-view${isEditing ? ' is-compact' : ''}`}>
                  <span className="crm-tag co-tag-chip" style={chipStyle(accent)}>
                    {isEditing && draft?.name.trim() ? draft.name.trim() : label.name}
                  </span>
                  {isEditing ? null : (
                    <div className="co-tag-card-copy">
                      {desc ? (
                        <p className="co-tag-desc">{desc}</p>
                      ) : (
                        <p className="muted co-tag-desc">{t('settingsLabelsDescriptionEmpty')}</p>
                      )}
                      <p className="muted co-tag-meta">
                        {t('settingsLabelsCreatedBy')
                          .replace('{name}', author)
                          .replace('{when}', when)}
                      </p>
                    </div>
                  )}
                  <div className="co-tag-actions">
                    {isEditing ? null : (
                      <button
                        type="button"
                        className="btn icon-btn"
                        disabled={busy}
                        aria-label={t('settingsLabelsEdit')}
                        title={t('settingsLabelsEdit')}
                        onClick={() => openEdit(label)}
                      >
                        <PencilSimple size={14} weight="regular" aria-hidden />
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn icon-btn"
                      disabled={busy}
                      aria-label={t('settingsLabelsDelete')}
                      title={t('settingsLabelsDelete')}
                      onClick={() => void removeLabel(label.id)}
                    >
                      <Trash size={14} weight="regular" aria-hidden />
                    </button>
                  </div>
                </div>

                {isEditing && draft ? (
                  <div className="co-tag-card-edit">
                    <label className="field">
                      <span className="label">{t('settingsLabelsName')}</span>
                      <input
                        className="input"
                        value={draft.name}
                        disabled={busy}
                        maxLength={40}
                        autoFocus
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            void saveEdit()
                          }
                        }}
                        aria-label={t('settingsLabelsName')}
                      />
                    </label>
                    <label className="field">
                      <span className="label">{t('settingsLabelsDescription')}</span>
                      <textarea
                        className="textarea"
                        rows={2}
                        maxLength={500}
                        disabled={busy}
                        value={draft.description}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        placeholder={t('settingsLabelsDescriptionPh')}
                      />
                    </label>
                    <div className="field">
                      <span className="label">{t('settingsLabelsColor')}</span>
                      <ColorDots
                        value={draft.color}
                        disabled={busy}
                        onPick={(c) => setDraft({ ...draft, color: c })}
                      />
                    </div>
                    <div className="co-tag-edit-actions">
                      <button type="button" className="btn" disabled={busy} onClick={closeEdit}>
                        {t('cancel')}
                      </button>
                      <button
                        type="button"
                        className="btn primary"
                        disabled={busy || !draft.name.trim()}
                        onClick={() => void saveEdit()}
                      >
                        {busy ? '…' : t('save')}
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {msg && !createOpen ? <p className="error">{msg}</p> : null}

      {createOpen
        ? createPortal(
            <div
              className="bu-modal-overlay"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget && !busy) closeCreate()
              }}
            >
              <form
                className="bu-modal panel crm-modal"
                role="dialog"
                aria-modal="true"
                aria-label={t('settingsLabelsAdd')}
                onSubmit={(e) => {
                  e.preventDefault()
                  void createLabel()
                }}
              >
                <header className="bu-modal-head">
                  <h2 className="section-title" style={{ margin: 0, fontSize: '1.1rem' }}>
                    {t('settingsLabelsAdd')}
                  </h2>
                  <button
                    type="button"
                    className="btn icon-btn"
                    disabled={busy}
                    aria-label={t('cancel')}
                    onClick={closeCreate}
                  >
                    <X size={16} weight="bold" aria-hidden />
                  </button>
                </header>
                <div className="crm-modal-body stack">
                  <label className="field">
                    <span className="label">{t('settingsLabelsName')}</span>
                    <input
                      className="input"
                      value={name}
                      disabled={busy}
                      maxLength={40}
                      autoFocus
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('settingsLabelsNamePh')}
                    />
                  </label>
                  <label className="field">
                    <span className="label">{t('settingsLabelsDescription')}</span>
                    <textarea
                      className="textarea"
                      rows={3}
                      maxLength={500}
                      disabled={busy}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t('settingsLabelsDescriptionPh')}
                    />
                  </label>
                  <div className="field">
                    <span className="label">{t('settingsLabelsColor')}</span>
                    <ColorDots value={color} disabled={busy} onPick={setColor} />
                  </div>
                  {msg ? <p className="error">{msg}</p> : null}
                </div>
                <footer className="bu-modal-actions">
                  <button type="button" className="btn" disabled={busy} onClick={closeCreate}>
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    className="btn primary"
                    disabled={busy || !name.trim()}
                  >
                    {busy ? '…' : t('settingsLabelsAdd')}
                  </button>
                </footer>
              </form>
            </div>,
            document.body,
          )
        : null}
    </section>
  )
}
