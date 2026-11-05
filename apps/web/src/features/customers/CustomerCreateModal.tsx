/**
 * CustomerCreateModal — create CRM customer (Dark-Ops fields).
 * Location: apps/web/src/features/customers/CustomerCreateModal.tsx
 */
import { useState } from 'react'
import { X } from '@phosphor-icons/react'
import { useI18n } from '../../lib/i18n'

type Props = {
  open: boolean
  onClose: () => void
  onSave: (body: {
    kind: 'person' | 'org'
    displayName?: string
    firstName?: string | null
    lastName?: string | null
    email?: string | null
    phone?: string | null
    relationStatus: 'lead' | 'customer'
  }) => Promise<void>
}

export function CustomerCreateModal({ open, onClose, onSave }: Props) {
  const { t } = useI18n()
  const [kind, setKind] = useState<'person' | 'org'>('person')
  const [displayName, setDisplayName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [relationStatus, setRelationStatus] = useState<'lead' | 'customer'>('lead')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  if (!open) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const orgName = displayName.trim()
    const fn = firstName.trim()
    const ln = lastName.trim()
    if (kind === 'org' ? !orgName : !fn && !ln) {
      setErr(t('customerErrName'))
      return
    }
    setSaving(true)
    setErr('')
    try {
      await onSave({
        kind,
        displayName: kind === 'org' ? orgName : undefined,
        firstName: kind === 'person' ? fn || null : null,
        lastName: kind === 'person' ? ln || null : null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        relationStatus,
      })
      setDisplayName('')
      setFirstName('')
      setLastName('')
      setEmail('')
      setPhone('')
      setRelationStatus('lead')
      setKind('person')
      onClose()
    } catch (ex) {
      setErr((ex as Error).message || t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bu-modal-overlay" role="dialog" aria-modal="true">
      <form className="bu-modal panel crm-modal" onSubmit={submit}>
        <header className="bu-modal-head">
          <h2 className="section-title" style={{ margin: 0, fontSize: '1.1rem' }}>
            {t('customerCreate')}
          </h2>
          <button
            type="button"
            className="btn icon-btn"
            onClick={onClose}
            disabled={saving}
            aria-label={t('cancel')}
            title={t('cancel')}
          >
            <X size={16} weight="bold" aria-hidden />
          </button>
        </header>
        <div className="crm-modal-body stack">
          <label className="field">
            <span className="label">{t('customerKind')}</span>
            <select
              className="input"
              value={kind}
              onChange={(e) => setKind(e.target.value as 'person' | 'org')}
            >
              <option value="person">{t('customerKindPerson')}</option>
              <option value="org">{t('customerKindOrg')}</option>
            </select>
          </label>
          {kind === 'person' ? (
            <div className="bu-modal-row-2">
              <label className="field">
                <span className="label">{t('customerFirstName')}</span>
                <input
                  className="input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoFocus
                />
              </label>
              <label className="field">
                <span className="label">{t('customerLastName')}</span>
                <input
                  className="input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </label>
            </div>
          ) : (
            <label className="field">
              <span className="label">{t('customerCompany')}</span>
              <input
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoFocus
              />
            </label>
          )}
          <label className="field">
            <span className="label">{t('email')}</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="label">{t('customerPhone')}</span>
            <input
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="label">{t('customerStatus')}</span>
            <select
              className="input"
              value={relationStatus}
              onChange={(e) => setRelationStatus(e.target.value as 'lead' | 'customer')}
            >
              <option value="lead">{t('customerStatusLead')}</option>
              <option value="customer">{t('customerStatusCustomer')}</option>
            </select>
          </label>
          {err ? <p className="error">{err}</p> : null}
        </div>
        <footer className="bu-modal-actions">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? '…' : t('save')}
          </button>
        </footer>
      </form>
    </div>
  )
}
