/**
 * CustomerCreateModal — create CRM contact (customer and/or partner).
 * Location: apps/web/src/features/customers/CustomerCreateModal.tsx
 */
import { useEffect, useMemo, useState } from 'react'
import { Buildings, SealCheck, User, UserPlus, X } from '@phosphor-icons/react'
import { PARTNER_CATEGORY_SUGGESTIONS } from '@bu2/shared'
import { CrmIconSelect, type CrmIconSelectOption } from '../../components/CrmIconSelect'
import { useI18n } from '../../lib/i18n'

export type ContactCreateBody = {
  kind: 'person' | 'org'
  displayName?: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  relationStatus: 'lead' | 'customer'
  isCustomer: boolean
  isPartner: boolean
  partnerCategory?: string | null
  partnerStatus?: 'active' | 'inactive'
}

type Props = {
  open: boolean
  onClose: () => void
  onSave: (body: ContactCreateBody) => Promise<void>
  /** Prefill roles from the active Kontakte tab. */
  defaultIsCustomer?: boolean
  defaultIsPartner?: boolean
}

export function CustomerCreateModal({
  open,
  onClose,
  onSave,
  defaultIsCustomer = true,
  defaultIsPartner = false,
}: Props) {
  const { t } = useI18n()
  const [kind, setKind] = useState<'person' | 'org'>('person')
  const [displayName, setDisplayName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [relationStatus, setRelationStatus] = useState<'lead' | 'customer'>('lead')
  const [isCustomer, setIsCustomer] = useState(defaultIsCustomer)
  const [isPartner, setIsPartner] = useState(defaultIsPartner)
  const [partnerCategory, setPartnerCategory] = useState('')
  const [partnerStatus, setPartnerStatus] = useState<'active' | 'inactive'>('active')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setKind('person')
    setDisplayName('')
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setRelationStatus('lead')
    setIsCustomer(defaultIsCustomer)
    setIsPartner(defaultIsPartner)
    setPartnerCategory('')
    setPartnerStatus('active')
    setSaving(false)
    setErr('')
  }, [open, defaultIsCustomer, defaultIsPartner])

  const kindOptions = useMemo<CrmIconSelectOption[]>(
    () => [
      {
        value: 'person',
        label: t('customerKindPerson'),
        icon: <User size={14} weight="regular" aria-hidden />,
      },
      {
        value: 'org',
        label: t('customerKindOrg'),
        icon: <Buildings size={14} weight="regular" aria-hidden />,
      },
    ],
    [t],
  )

  const statusOptions = useMemo<CrmIconSelectOption[]>(
    () => [
      {
        value: 'lead',
        label: t('customerStatusLead'),
        icon: <UserPlus size={14} weight="regular" aria-hidden />,
        tone: 'lead',
      },
      {
        value: 'customer',
        label: t('customerStatusCustomer'),
        icon: <SealCheck size={14} weight="regular" aria-hidden />,
        tone: 'customer',
      },
    ],
    [t],
  )

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
    if (!isCustomer && !isPartner) {
      setErr(t('contactErrRole'))
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
        relationStatus: isCustomer ? relationStatus : 'lead',
        isCustomer,
        isPartner,
        partnerCategory: isPartner ? partnerCategory.trim() || null : null,
        partnerStatus: isPartner ? partnerStatus : 'active',
      })
      setDisplayName('')
      setFirstName('')
      setLastName('')
      setEmail('')
      setPhone('')
      setRelationStatus('lead')
      setKind('person')
      setIsCustomer(defaultIsCustomer)
      setIsPartner(defaultIsPartner)
      setPartnerCategory('')
      setPartnerStatus('active')
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
            {t('contactCreate')}
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
          <fieldset className="field" style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="label">{t('contactRoles')}</legend>
            <div className="bu-modal-row-2" style={{ marginTop: 6 }}>
              <label className="crm-check-row">
                <input
                  type="checkbox"
                  checked={isCustomer}
                  onChange={(e) => setIsCustomer(e.target.checked)}
                  disabled={saving}
                />
                <span>{t('contactRoleCustomer')}</span>
              </label>
              <label className="crm-check-row">
                <input
                  type="checkbox"
                  checked={isPartner}
                  onChange={(e) => setIsPartner(e.target.checked)}
                  disabled={saving}
                />
                <span>{t('contactRolePartner')}</span>
              </label>
            </div>
          </fieldset>
          <label className="field">
            <span className="label">{t('customerKind')}</span>
            <CrmIconSelect
              name="kind"
              value={kind}
              options={kindOptions}
              onChange={(v) => setKind(v as 'person' | 'org')}
              disabled={saving}
              aria-label={t('customerKind')}
            />
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
          {isCustomer ? (
            <label className="field">
              <span className="label">{t('customerStatus')}</span>
              <CrmIconSelect
                name="relationStatus"
                value={relationStatus}
                options={statusOptions}
                onChange={(v) => setRelationStatus(v as 'lead' | 'customer')}
                disabled={saving}
                aria-label={t('customerStatus')}
              />
            </label>
          ) : null}
          {isPartner ? (
            <>
              <label className="field">
                <span className="label">{t('partnerCategory')}</span>
                <input
                  className="input"
                  list="partner-category-suggestions"
                  value={partnerCategory}
                  onChange={(e) => setPartnerCategory(e.target.value)}
                  placeholder={t('partnerCategoryPh')}
                />
                <datalist id="partner-category-suggestions">
                  {PARTNER_CATEGORY_SUGGESTIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <div className="crm-tag-row" style={{ marginTop: 8 }}>
                  {PARTNER_CATEGORY_SUGGESTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="crm-tag"
                      onClick={() => setPartnerCategory(c)}
                      disabled={saving}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </label>
              <label className="field">
                <span className="label">{t('partnerStatus')}</span>
                <select
                  className="input"
                  value={partnerStatus}
                  onChange={(e) => setPartnerStatus(e.target.value as 'active' | 'inactive')}
                  disabled={saving}
                >
                  <option value="active">{t('partnerStatusActive')}</option>
                  <option value="inactive">{t('partnerStatusInactive')}</option>
                </select>
              </label>
            </>
          ) : null}
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
