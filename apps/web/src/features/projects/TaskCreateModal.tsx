/**
 * TaskCreateModal — create one-shot or recurring task (2-col meta, rhythm fields).
 * Location: apps/web/src/features/projects/TaskCreateModal.tsx
 */
import { ArrowDown, ArrowUp, Folders, Minus } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { CrmIconSelect, type CrmIconSelectOption } from '../../components/CrmIconSelect'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import type { BuProject } from './projectTypes'
import { ProjectGlyphAvatar } from './projectVisual'
import {
  remindersToPayload,
  TaskRemindersField,
  type ReminderDraft,
} from './TaskRemindersField'

type MemberOpt = {
  userId: string
  email: string
  displayName: string | null
}

type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'done'
type TaskMode = 'once' | 'recurring'
type RecurrenceFreq = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'

type Props = {
  open: boolean
  slug: string
  projects: BuProject[]
  defaultProjectId?: string | null
  /** Prefill status (e.g. board lane “+ Aufgabe”). */
  defaultStatus?: TaskStatus
  /** Prefill create mode (recurring page opens here). */
  defaultMode?: TaskMode
  onClose: () => void
  onSave: (body: {
    title: string
    description: string
    projectId?: string | null
    priority: 'low' | 'medium' | 'high'
    status: TaskStatus
    assigneeUserId?: string | null
    dueAt?: string | null
    reminders?: Array<{
      offsetValue: number
      offsetUnit: 'minutes' | 'hours' | 'days' | 'weeks'
      channel: 'notification' | 'email'
    }>
  }) => Promise<void>
  /** Called after a successful create (once or recurring). */
  onCreated?: () => void
}

function memberLabel(m: MemberOpt) {
  return m.displayName?.trim() || m.email
}

function dueAtFromDateInput(v: string): string | null {
  if (!v.trim()) return null
  const d = new Date(`${v.trim()}T17:00:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function startsAtFromInputs(dateStr: string, timeStr: string): string {
  const time = timeStr.trim() || '09:00'
  const date = dateStr.trim() || new Date().toISOString().slice(0, 10)
  const d = new Date(`${date}T${time}:00`)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

const WEEKDAY_KEYS = [
  'weekdaySun',
  'weekdayMon',
  'weekdayTue',
  'weekdayWed',
  'weekdayThu',
  'weekdayFri',
  'weekdaySat',
] as const

export function TaskCreateModal({
  open,
  slug,
  projects,
  defaultProjectId,
  defaultStatus = 'open',
  defaultMode = 'once',
  onClose,
  onSave,
  onCreated,
}: Props) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState(defaultProjectId || '')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [assigneeUserId, setAssigneeUserId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [mode, setMode] = useState<TaskMode>(defaultMode)
  const [freq, setFreq] = useState<RecurrenceFreq>('weekly')
  const [weekday, setWeekday] = useState(1)
  const [monthDay, setMonthDay] = useState(1)
  const [timeOfDay, setTimeOfDay] = useState('09:00')
  const [reminders, setReminders] = useState<ReminderDraft[]>([])
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
    setMode(defaultMode)
    setFreq('weekly')
    setWeekday(1)
    setMonthDay(1)
    setTimeOfDay('09:00')
    setReminders([])
    setErr('')
    setMembersLoading(true)
    api<{ members: MemberOpt[] }>(`/api/b/${slug}/members`)
      .then((r) => setMembers(r.members || []))
      .catch(() => setMembers([]))
      .finally(() => setMembersLoading(false))
  }, [open, slug, defaultProjectId, defaultMode])

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
      const reminderPayload = remindersToPayload(reminders)
      if (mode === 'recurring') {
        await api(`/api/b/${slug}/recurrence`, {
          method: 'POST',
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            projectId: projectId || null,
            priority,
            assigneeUserId: assigneeUserId || null,
            freq,
            weekday: freq === 'weekly' ? weekday : null,
            monthDay: freq === 'monthly' || freq === 'yearly' ? monthDay : null,
            startsAt: startsAtFromInputs(dueDate, timeOfDay),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin',
            reminders: reminderPayload,
          }),
        })
      } else {
        await onSave({
          title: title.trim(),
          description: description.trim(),
          projectId: projectId || null,
          priority,
          status: defaultStatus,
          assigneeUserId: assigneeUserId || null,
          dueAt: dueAtFromDateInput(dueDate),
          reminders: reminderPayload,
        })
      }
      onCreated?.()
      onClose()
    } catch (ex) {
      setErr((ex as Error).message || t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const showWeekday = mode === 'recurring' && freq === 'weekly'
  const showMonthDay = mode === 'recurring' && (freq === 'monthly' || freq === 'yearly')
  const showTime = mode === 'recurring' && freq !== 'hourly'

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

          <label className="field">
            <span className="label">{t('taskMode')}</span>
            <select
              className="input"
              name="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as TaskMode)}
            >
              <option value="once">{t('taskModeOnce')}</option>
              <option value="recurring">{t('taskModeRecurring')}</option>
            </select>
          </label>

          {mode === 'recurring' ? (
            <div className="task-create-grid">
              <label className="field">
                <span className="label">{t('taskRecurrenceFreq')}</span>
                <select
                  className="input"
                  name="freq"
                  value={freq}
                  onChange={(e) => setFreq(e.target.value as RecurrenceFreq)}
                >
                  <option value="hourly">{t('freqHourly')}</option>
                  <option value="daily">{t('freqDaily')}</option>
                  <option value="weekly">{t('freqWeekly')}</option>
                  <option value="monthly">{t('freqMonthly')}</option>
                  <option value="yearly">{t('freqYearly')}</option>
                </select>
              </label>
              {showTime ? (
                <label className="field">
                  <span className="label">{t('taskRecurrenceTime')}</span>
                  <input
                    className="input"
                    type="time"
                    name="timeOfDay"
                    value={timeOfDay}
                    onChange={(e) => setTimeOfDay(e.target.value)}
                  />
                </label>
              ) : null}
              {showWeekday ? (
                <label className="field">
                  <span className="label">{t('taskRecurrenceWeekday')}</span>
                  <select
                    className="input"
                    name="weekday"
                    value={weekday}
                    onChange={(e) => setWeekday(Number(e.target.value))}
                  >
                    {WEEKDAY_KEYS.map((key, i) => (
                      <option key={key} value={i}>
                        {t(key)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {showMonthDay ? (
                <label className="field">
                  <span className="label">{t('taskRecurrenceMonthDay')}</span>
                  <input
                    className="input"
                    type="number"
                    name="monthDay"
                    min={1}
                    max={31}
                    value={monthDay}
                    onChange={(e) => setMonthDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                  />
                </label>
              ) : null}
            </div>
          ) : null}

          <div className="task-create-grid">
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
              <span className="label">
                {mode === 'recurring' ? t('taskRecurrenceStart') : t('taskDue')}
              </span>
              <input
                className="input"
                type="date"
                name="dueAt"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
          </div>

          <TaskRemindersField value={reminders} onChange={setReminders} />

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
