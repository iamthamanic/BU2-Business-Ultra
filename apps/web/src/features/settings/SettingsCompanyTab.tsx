/**
 * SettingsCompanyTab — Details: logo, stammdaten (name/slug/status/meta), danger zone.
 * Location: apps/web/src/features/settings/SettingsCompanyTab.tsx
 */
import { useEffect, useState } from 'react'
import { Check, Copy } from '@phosphor-icons/react'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { MessageKey } from '../../i18n/messages'
import { SettingsLogoTab } from './SettingsLogoTab'

const ROLE_LABEL: Record<string, MessageKey> = {
  owner: 'roleOwner',
  admin: 'roleAdmin',
  editor: 'roleEditor',
  viewer: 'roleViewer',
}

type Props = {
  slug: string
  name: string
  logoPath?: string | null
  companyStatus: string
  createdAt?: string | null
  role?: string | null
  msg: string
  canEdit: boolean
  onMetaChanged: (next: { name?: string; logoPath?: string | null }) => void
  onArchive: () => void
  onReactivate: () => void
  onDelete: (confirmSlug: string) => void | Promise<void>
}

function formatCreated(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function SettingsCompanyTab({
  slug,
  name,
  logoPath,
  companyStatus,
  createdAt,
  role,
  msg,
  canEdit,
  onMetaChanged,
  onArchive,
  onReactivate,
  onDelete,
}: Props) {
  const { t } = useI18n()
  const archived = companyStatus === 'archived'
  const [editName, setEditName] = useState(name)
  const [saving, setSaving] = useState(false)
  const [formMsg, setFormMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmSlug, setConfirmSlug] = useState('')
  const [deleting, setDeleting] = useState(false)
  const canDelete = confirmSlug.trim() === slug
  const nameDirty = editName.trim() !== name.trim()

  useEffect(() => {
    setEditName(name)
  }, [name])

  async function saveName() {
    const next = editName.trim().replace(/\s+/g, ' ')
    if (!next || !canEdit || saving || !nameDirty) return
    setSaving(true)
    setFormMsg('')
    try {
      const r = await api<{ business: { name: string } }>(`/api/b/${slug}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: next }),
      })
      onMetaChanged({ name: r.business.name })
      setFormMsg(t('companyNameSaved'))
    } catch (e) {
      setFormMsg(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function copySlug() {
    try {
      await navigator.clipboard.writeText(slug)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setFormMsg(t('copyFailed'))
    }
  }

  async function confirmDelete() {
    if (!canDelete || deleting) return
    setDeleting(true)
    try {
      await onDelete(confirmSlug.trim())
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="stack co-details">
      <SettingsLogoTab
        slug={slug}
        name={name}
        logoPath={logoPath}
        onChanged={(path) => onMetaChanged({ logoPath: path })}
      />

      <section className="panel stack co-stammdaten">
        <div className="co-card-head">
          <div>
            <h3 className="co-card-title">{t('companyStammdaten')}</h3>
            <p className="muted co-card-hint">{t('companyStammdatenHint')}</p>
          </div>
        </div>

        <div className="co-stammdaten-grid">
          <div className="field co-stammdaten-name">
            <span className="label" id="co-company-name-lbl">
              {t('companyName')}
            </span>
            <div className="co-stammdaten-name-row">
              <input
                className="input"
                value={editName}
                disabled={!canEdit || saving}
                maxLength={120}
                aria-labelledby="co-company-name-lbl"
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void saveName()
                  }
                }}
                placeholder={t('companyNamePh')}
              />
              {canEdit ? (
                <button
                  type="button"
                  className="btn primary"
                  disabled={saving || !nameDirty || !editName.trim()}
                  onClick={() => void saveName()}
                >
                  {saving ? '…' : t('save')}
                </button>
              ) : null}
            </div>
          </div>

          <div className="field">
            <span className="label">{t('slug')}</span>
            <div className="co-slug-row">
              <code className="co-slug-value">{slug}</code>
              <button
                type="button"
                className="btn icon-btn"
                aria-label={copied ? t('copied') : t('copySlug')}
                title={copied ? t('copied') : t('copySlug')}
                onClick={() => void copySlug()}
              >
                {copied ? (
                  <Check size={14} weight="bold" aria-hidden />
                ) : (
                  <Copy size={14} weight="regular" aria-hidden />
                )}
              </button>
            </div>
            <p className="muted co-field-hint">{t('slugImmutableHint')}</p>
          </div>

          <div className="field">
            <span className="label">{t('status')}</span>
            <span className={`badge ${archived ? 'warn' : 'ok'}`}>
              {archived ? t('statusArchived') : t('statusActive')}
            </span>
          </div>

          <div className="field">
            <span className="label">{t('companyCreatedAt')}</span>
            <p className="co-meta-value">{formatCreated(createdAt)}</p>
          </div>

          <div className="field">
            <span className="label">{t('yourRole')}</span>
            <p className="co-meta-value">
              {role && ROLE_LABEL[role] ? t(ROLE_LABEL[role]!) : role || '—'}
            </p>
          </div>
        </div>

        {formMsg ? <p className="muted">{formMsg}</p> : null}
      </section>

      <section className="panel stack co-danger-zone">
        <h3 className="co-card-title">{t('dangerZone')}</h3>
        <p className="muted" style={{ margin: 0 }}>
          {t('dangerZoneHint')}
        </p>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {archived ? (
            <button className="btn" type="button" disabled={!canEdit} onClick={onReactivate}>
              {t('reactivate')}
            </button>
          ) : (
            <button className="btn danger" type="button" disabled={!canEdit} onClick={onArchive}>
              {t('archive')}
            </button>
          )}
          <button
            className="btn danger"
            type="button"
            disabled={!canEdit}
            onClick={() => {
              setDeleteOpen((v) => !v)
              setConfirmSlug('')
            }}
          >
            {t('deleteCompany')}
          </button>
        </div>

        {deleteOpen ? (
          <div className="stack co-delete-confirm">
            <p className="co-delete-warn" role="alert">
              {t('deleteCompanyWarn')}
            </p>
            <p className="muted" style={{ margin: 0 }}>
              {t('deleteCompanyTypeSlug').replace('{slug}', slug).replace('{name}', name)}
            </p>
            <label className="stack" style={{ gap: 4 }}>
              <span className="filter-lbl muted">{t('deleteCompanyConfirmLabel')}</span>
              <input
                className="input"
                value={confirmSlug}
                onChange={(e) => setConfirmSlug(e.target.value)}
                placeholder={slug}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <div className="row" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setDeleteOpen(false)
                  setConfirmSlug('')
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={!canDelete || deleting}
                onClick={() => void confirmDelete()}
              >
                {deleting ? t('deletingCompany') : t('deleteCompanyForever')}
              </button>
            </div>
          </div>
        ) : null}

        {msg ? <p className="muted">{msg}</p> : null}
      </section>
    </div>
  )
}
