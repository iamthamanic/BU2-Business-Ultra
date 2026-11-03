/**
 * TaskCreateModal — create task (project icon, assignee, priority tone, deadline).
 * Location: apps/web/src/features/projects/TaskCreateModal.tsx
 */
import { ArrowDown, ArrowUp, Folders, Minus } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { CrmIconSelect, type CrmIconSelectOption } from '../../components/CrmIconSelect'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { BuProject } from './projectTypes'
import { ProjectGlyphAvatar } from './projectVisual'

type MemberOpt = {
  userId: string
  email: string
  displayName: string | null
}

type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'done'

type Props = {
  open: boolean
  slug: string
  projects: BuProject[]
  defaultProjectId?: string | null
  /** Prefill status (e.g. board lane “+ Aufgabe”). */
  defaultStatus?: TaskStatus
  onClose: () => void
  onSave: (body: {
    title: string
    description: string
    projectId?: string | null
    priority: 'low' | 'medium' | 'high'
    status: TaskStatus
    assigneeUserId?: string | null
    dueAt?: string | null
  }) => Promise<void>
}

function memberLabel(m: MemberOpt) {
  return m.displayName?.trim() || m.email
}

function dueAtFromDateInput(v: string): string | null {
  if (!v.trim()) return null
  const d = new Date(`${v.trim()}T17:00:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function TaskCreateModal({
  open,
  slug,
  projects,
  defaultProjectId,
  defaultStatus = 'open',
  onClose,
  onSave,
}: Props) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState(defaultProjectId || '')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [assigneeUserId, setAssigneeUserId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [members, setMembers] = useState<MemberOpt[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setProjectId(defaultProjectId || '')
    setTitle('')
    setDescription('')
    setPriority('medium')
    setAssigneeUserId('')
    setDueDate('')
    setErr('')
    setMembersLoading(true)
    api<{ members: MemberOpt[] }>(`/api/b/${slug}/members`)
      .then((r) => setMembers(r.members || []))
      .catch(() => setMembers([]))
      .finally(() => setMembersLoading(false))
  }, [open, slug, defaultProjectId])

  const projectOptions = useMemo<CrmIconSelectOption[]>(
    () => [
      {
        value: '',
        label: t('taskInbox'),
        icon: (
          <span className="crm-pick-av project-av" data-ic="inbox" aria-hidden>
            <Folders size={14} weight="regular" />
          </span>
        ),
      },
      ...projects.map((p) => ({
        value: p.id,
        label: p.name,
        icon: <ProjectGlyphAvatar project={p} size={14} className="crm-pick-av project-av" />,
      })),
    ],
    [projects, t],
  )

  const priorityOptions = useMemo<CrmIconSelectOption[]>(
    () => [
      {
        value: 'low',
        label: t('taskPriorityLow'),
        tone: 'low',
        icon: <ArrowDown size={14} weight="bold" aria-hidden />,
      },
      {
        value: 'medium',
        label: t('taskPriorityMedium'),
        tone: 'medium',
        icon: <Minus size={14} weight="bold" aria-hidden />,
      },
      {
        value: 'high',
        label: t('taskPriorityHigh'),
        tone: 'high',
        icon: <ArrowUp size={14} weight="bold" aria-hidden />,
      },
    ],
    [t],
  )

  if (!open) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setErr(t('taskErrTitle'))
      return
    }
    setSaving(true)
    setErr('')
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        projectId: projectId || null,
        priority,
        status: defaultStatus,
        assigneeUserId: assigneeUserId || null,
        dueAt: dueAtFromDateInput(dueDate),
      })
      onClose()
    } catch (ex) {
      setErr((ex as Error).message || t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bu-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="task-create-title">
      <form className="bu-modal panel crm-modal" onSubmit={submit}>
        <header className="bu-modal-head">
          <h2 id="task-create-title" className="section-title" style={{ margin: 0, fontSize: '1.1rem' }}>
            {t('taskCreate')}
          </h2>
        </header>
        <div className="crm-modal-body stack">
          <label className="field">
            <span className="label">{t('taskTitle')}</span>
            <input
              className="input"
              name="title"
              autoComplete="off"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </label>
          <label className="field">
            <span className="label">{t('description')}</span>
            <textarea
              className="input textarea"
              name="description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="field">
            <span className="label" id="task-project-label">
              {t('projects')}
            </span>
            <CrmIconSelect
              name="projectId"
              value={projectId}
              options={projectOptions}
              onChange={setProjectId}
              aria-label={t('projects')}
            />
          </div>
          <label className="field">
            <span className="label">{t('taskAssignee')}</span>
            <select
              className="input"
              name="assigneeUserId"
              value={assigneeUserId}
              onChange={(e) => setAssigneeUserId(e.target.value)}
              disabled={membersLoading}
            >
              <option value="">{t('taskAssigneeNone')}</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {memberLabel(m)}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span className="label" id="task-priority-label">
              {t('taskPriority')}
            </span>
            <CrmIconSelect
              name="priority"
              value={priority}
              options={priorityOptions}
              onChange={(v) => setPriority(v as 'low' | 'medium' | 'high')}
              aria-label={t('taskPriority')}
            />
          </div>
          <label className="field">
            <span className="label">{t('taskDue')}</span>
            <input
              className="input"
              type="date"
              name="dueAt"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          {err ? <p className="error" role="alert">{err}</p> : null}
        </div>
        <footer className="bu-modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? t('saving') : t('save')}
          </button>
        </footer>
      </form>
    </div>
  )
}
