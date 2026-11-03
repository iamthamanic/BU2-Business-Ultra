/**
 * SettingsLabelsTab — company labels by scope (customer / project / marketing / product).
 * Location: apps/web/src/features/settings/SettingsLabelsTab.tsx
 */
import { useEffect, useState } from 'react'
import {
  FolderSimple,
  Megaphone,
  Package,
  Plus,
  Trash,
  User,
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

type Props = { slug: string }

export function SettingsLabelsTab({ slug }: Props) {
  const { t } = useI18n()
  const [scope, setScope] = useState<BusinessLabelScope>('customer')
  const [labels, setLabels] = useState<BusinessLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(TAG_COLORS[0]!)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

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

  async function createLabel() {
    const n = name.trim()
    if (!n || busy) return
    setBusy(true)
    setMsg('')
    try {
      await api(`/api/b/${slug}/labels`, {
        method: 'POST',
        body: JSON.stringify({ name: n, color, scope }),
      })
      setName('')
      await refresh()
    } catch (e) {
      setMsg(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveRename(id: string) {
    const n = editName.trim()
    if (!n || busy) return
    setBusy(true)
    setMsg('')
    try {
      await api(`/api/b/${slug}/labels/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: n }),
      })
      setEditingId(null)
      await refresh()
    } catch (e) {
      setMsg(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function setLabelColor(id: string, next: string | null) {
    setBusy(true)
    setMsg('')
    try {
      await api(`/api/b/${slug}/labels/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ color: next }),
      })
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
      await refresh()
    } catch (e) {
      setMsg(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel stack">
      <div className="co-card-head">
        <div>
          <h3 className="co-card-title">{t('settingsLabels')}</h3>
          <p className="muted co-card-hint">{t('settingsLabelsHint')}</p>
        </div>
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
              setEditingId(null)
              setMsg('')
            }}
          />
        ))}
      </MktTabs>

      {loading ? (
        <p className="muted">{t('loading')}</p>
      ) : labels.length === 0 ? (
        <p className="muted">{t('settingsLabelsEmpty')}</p>
      ) : (
        <ul className="co-tag-list">
          {labels.map((label) => (
            <li key={label.id} className="co-tag-row">
              <span
                className="crm-tag co-tag-swatch"
                style={
                  label.color
                    ? {
                        borderColor: `color-mix(in srgb, ${label.color} 45%, var(--border))`,
                        background: `color-mix(in srgb, ${label.color} 16%, var(--panel2))`,
                        color: label.color,
                      }
                    : undefined
                }
              >
                {editingId === label.id ? (
                  <input
                    className="input co-tag-rename"
                    value={editName}
                    disabled={busy}
                    autoFocus
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void saveRename(label.id)
                      }
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    aria-label={t('settingsLabelsRename')}
                  />
                ) : (
                  <button
                    type="button"
                    className="co-tag-name-btn"
                    disabled={busy}
                    onClick={() => {
                      setEditingId(label.id)
                      setEditName(label.name)
                    }}
                    title={t('settingsLabelsRename')}
                  >
                    {label.name}
                  </button>
                )}
              </span>
              <div className="co-tag-colors" role="group" aria-label={t('settingsLabelsColor')}>
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`co-tag-color${label.color === c ? ' is-on' : ''}`}
                    style={{ background: c }}
                    disabled={busy}
                    aria-label={c}
                    onClick={() => void setLabelColor(label.id, c)}
                  />
                ))}
              </div>
              <div className="co-tag-actions">
                {editingId === label.id ? (
                  <button
                    type="button"
                    className="btn primary"
                    disabled={busy || !editName.trim()}
                    onClick={() => void saveRename(label.id)}
                  >
                    {t('save')}
                  </button>
                ) : null}
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
            </li>
          ))}
        </ul>
      )}

      <form
        className="co-connect-box stack"
        onSubmit={(e) => {
          e.preventDefault()
          void createLabel()
        }}
      >
        <strong>{t('settingsLabelsAdd')}</strong>
        <label className="field">
          <span className="label">{t('settingsLabelsName')}</span>
          <input
            className="input"
            value={name}
            disabled={busy}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('settingsLabelsNamePh')}
          />
        </label>
        <div className="co-tag-colors" role="group" aria-label={t('settingsLabelsColor')}>
          {TAG_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`co-tag-color${color === c ? ' is-on' : ''}`}
              style={{ background: c }}
              disabled={busy}
              aria-label={c}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <div>
          <button type="submit" className="btn primary" disabled={busy || !name.trim()}>
            <Plus size={14} weight="bold" aria-hidden />
            {busy ? '…' : t('settingsLabelsAdd')}
          </button>
        </div>
      </form>

      {msg ? <p className="error">{msg}</p> : null}
    </section>
  )
}
