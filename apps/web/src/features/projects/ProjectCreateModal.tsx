/**
 * ProjectCreateModal — landscape hybrid: compact type, dates, owner + team.
 * Location: apps/web/src/features/projects/ProjectCreateModal.tsx
 */
import { useEffect, useMemo, useState } from 'react'
import { Check, UsersThree, X } from '@phosphor-icons/react'
import { useI18n } from '../../lib/i18n'
import { MemberAvatar, memberDisplayName, type MemberInfo } from './MemberAvatar'
import type { BuProject } from './projectTypes'

type CreateBody = {
  type: 'area' | 'custom'
  name: string
  description: string
  area?: string | null
  parentAreaProjectId?: string | null
  status: 'planned' | 'active'
  ownerUserId?: string | null
  memberUserIds?: string[]
  startAt?: string | null
  dueAt?: string | null
}

type Props = {
  open: boolean
  areas: BuProject[]
  members: MemberInfo[]
  currentUserId?: string | null
  onClose: () => void
  onSave: (body: CreateBody) => Promise<void>
}

function dateToIso(v: string): string | null {
  if (!v.trim()) return null
  const d = new Date(`${v.trim()}T09:00:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function ProjectCreateModal({
  open,
  areas,
  members,
  currentUserId,
  onClose,
  onSave,
}: Props) {
  const { t } = useI18n()
  const [type, setType] = useState<'area' | 'custom'>('custom')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [area, setArea] = useState('')
  const [parentAreaProjectId, setParentAreaProjectId] = useState('')
  const [status, setStatus] = useState<'planned' | 'active'>('active')
  const [ownerUserId, setOwnerUserId] = useState('')
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setType('custom')
    setName('')
    setDescription('')
    setArea('')
    setParentAreaProjectId('')
    setStatus('active')
    setOwnerUserId(currentUserId || '')
    setMemberIds([])
    setStartDate('')
    setDueDate('')
    setErr('')
  }, [open, currentUserId])

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) =>
        memberDisplayName(a).localeCompare(memberDisplayName(b), undefined, {
          sensitivity: 'base',
        }),
      ),
    [members],
  )

  if (!open) return null

  function toggleMember(userId: string) {
    if (userId === ownerUserId) return
    setMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setErr(t('projectErrName'))
      return
    }
    setSaving(true)
    setErr('')
    try {
      const owner = ownerUserId || currentUserId || null
      await onSave({
        type,
        name: name.trim(),
        description: description.trim(),
        area: type === 'area' ? area.trim() || name.trim() : null,
        parentAreaProjectId: type === 'custom' && parentAreaProjectId ? parentAreaProjectId : null,
        status,
        ownerUserId: owner,
        memberUserIds: memberIds.filter((id) => id !== owner),
        startAt: dateToIso(startDate),
        dueAt: dateToIso(dueDate),
      })
      onClose()
    } catch (ex) {
      setErr((ex as Error).message || t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="bu-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-create-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <form className="bu-modal panel crm-modal project-create-modal" onSubmit={submit}>
        <header className="bu-modal-head project-create-head">
          <div>
            <p className="muted project-create-kicker">{t('projects')}</p>
            <h2 id="project-create-title" className="section-title project-create-title">
              {t('projectCreate')}
            </h2>
          </div>
          <button
            type="button"
            className="btn icon-btn"
            onClick={onClose}
            disabled={saving}
            aria-label={t('cancel')}
          >
            <X size={16} weight="bold" aria-hidden />
          </button>
        </header>

        <div className="crm-modal-body project-create-body">
          <div className="project-create-col">
            <fieldset className="project-create-fieldset">
              <legend className="label">{t('projectType')}</legend>
              <div className="project-create-status" role="radiogroup" aria-label={t('projectType')}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={type === 'custom'}
                  className={`archive-seg${type === 'custom' ? ' is-on' : ''}`}
                  onClick={() => setType('custom')}
                >
                  {t('projectTypeCustom')}
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={type === 'area'}
                  className={`archive-seg${type === 'area' ? ' is-on' : ''}`}
                  onClick={() => setType('area')}
                >
                  {t('projectTypeArea')}
                </button>
              </div>
            </fieldset>

            <label className="field">
              <span className="label">{t('name')}</span>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('projectNamePh')}
                autoFocus
              />
            </label>

            <label className="field">
              <span className="label">{t('description')}</span>
              <textarea
                className="input textarea"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('projectDescPh')}
              />
            </label>

            {type === 'area' ? (
              <label className="field">
                <span className="label">{t('projectAreaLabel')}</span>
                <input
                  className="input"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder={t('projectAreaPh')}
                />
              </label>
            ) : (
              <label className="field">
                <span className="label">{t('projectParentArea')}</span>
                <select
                  className="input"
                  value={parentAreaProjectId}
                  onChange={(e) => setParentAreaProjectId(e.target.value)}
                >
                  <option value="">—</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="project-settings-row">
              <label className="field">
                <span className="label">{t('projectStartLabel')}</span>
                <input
                  className="input"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="label">{t('projectDueLabel')}</span>
                <input
                  className="input"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </label>
            </div>

            <p className="muted project-create-access-note">{t('projectVisibilityTeamOnly')}</p>
          </div>

          <div className="project-create-col project-create-col--side">
            <fieldset className="project-create-fieldset">
              <legend className="label">{t('projectStatus')}</legend>
              <div className="project-create-status" role="group">
                <button
                  type="button"
                  className={`archive-seg${status === 'active' ? ' is-on' : ''}`}
                  aria-pressed={status === 'active'}
                  onClick={() => setStatus('active')}
                >
                  {t('projectStatusActive')}
                </button>
                <button
                  type="button"
                  className={`archive-seg${status === 'planned' ? ' is-on' : ''}`}
                  aria-pressed={status === 'planned'}
                  onClick={() => setStatus('planned')}
                >
                  {t('projectStatusPlanned')}
                </button>
              </div>
            </fieldset>

            <label className="field">
              <span className="label">{t('projectOwner')}</span>
              <select
                className="input"
                value={ownerUserId}
                onChange={(e) => {
                  const next = e.target.value
                  setOwnerUserId(next)
                  setMemberIds((prev) => prev.filter((id) => id !== next))
                }}
              >
                <option value="">{t('taskAssigneeNone')}</option>
                {sortedMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {memberDisplayName(m)}
                  </option>
                ))}
              </select>
            </label>

            <div className="field">
              <span className="label">
                <UsersThree size={12} weight="regular" aria-hidden /> {t('projectTeamAssign')}
              </span>
              <p className="muted project-create-team-hint">{t('projectTeamAssignHint')}</p>
              {sortedMembers.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>
                  {t('noMembers')}
                </p>
              ) : (
                <ul className="project-create-member-list">
                  {sortedMembers.map((m) => {
                    const isOwner = m.userId === ownerUserId
                    const on = isOwner || memberIds.includes(m.userId)
                    return (
                      <li key={m.userId}>
                        <button
                          type="button"
                          className={`project-create-member${on ? ' is-on' : ''}${isOwner ? ' is-owner' : ''}`}
                          aria-pressed={on}
                          disabled={isOwner}
                          onClick={() => toggleMember(m.userId)}
                        >
                          <MemberAvatar member={m} size={26} />
                          <span className="project-create-member-meta">
                            <strong>{memberDisplayName(m)}</strong>
                            {isOwner ? (
                              <span className="muted">{t('projectOwner')}</span>
                            ) : (
                              <span className="muted">{m.email}</span>
                            )}
                          </span>
                          {on ? <Check size={14} weight="bold" aria-hidden /> : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        {err ? <p className="error project-create-err">{err}</p> : null}

        <footer className="bu-modal-actions project-create-actions">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? '…' : t('projectCreate')}
          </button>
        </footer>
      </form>
    </div>
  )
}
