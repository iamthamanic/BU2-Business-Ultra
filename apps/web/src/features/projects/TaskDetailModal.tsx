/**
 * TaskDetailModal — premium task / recurring-rule detail.
 * Body modes: Beschreibung (rich text) | Checkliste. Comments via NoteThread.
 * Location: apps/web/src/features/projects/TaskDetailModal.tsx
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  CheckCircle,
  Circle,
  CircleNotch,
  ListChecks,
  Minus,
  Paperclip,
  PencilSimple,
  TextT,
  Trash,
  X,
} from '@phosphor-icons/react'
import { CrmIconSelect, type CrmIconSelectOption } from '../../components/CrmIconSelect'
import { ChecklistPanel } from '../../components/checklist/ChecklistPanel'
import { MktTab, MktTabs } from '../../components/MktTabs'
import { NoteThread } from '../../components/notes/NoteThread'
import {
  NoteEditor,
  notePlainText,
  sanitizeNoteHtml,
} from '../../components/notes/NoteEditor'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { MemberAvatar, memberDisplayName, type MemberInfo } from './MemberAvatar'
import type { BuTask, BuTaskAttachment } from './projectTypes'
import { TASK_STATUSES, formatReopenCountdown, taskStatusLabel } from './taskLabels'
import {
  remindersFromApi,
  remindersToPayload,
  TaskRemindersField,
  type ReminderDraft,
} from './TaskRemindersField'

type Comment = {
  id: string
  body: string
  createdAt: string
  authorDisplayName?: string | null
  authorUserId?: string | null
}
type CheckItem = { id: string; title: string; done: boolean }
type MemberById = Record<string, MemberInfo>
type DetailSource = 'task' | 'rule'
type BodyMode = 'description' | 'checklist'

type Props = {
  slug: string
  taskId: string | null
  /** rule = recurrence series opened with the same modal chrome. */
  source?: DetailSource
  canWrite: boolean
  memberById?: MemberById
  members?: MemberInfo[]
  onClose: () => void
  onChanged: () => void
}

const MAX_BYTES = 10 * 1024 * 1024

function dueInputValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function dueAtFromDateInput(v: string): string | null {
  if (!v.trim()) return null
  const d = new Date(`${v.trim()}T17:00:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function descEqual(a: string, b: string): boolean {
  return sanitizeNoteHtml(a) === sanitizeNoteHtml(b)
}

export function TaskDetailModal({
  slug,
  taskId,
  source = 'task',
  canWrite,
  memberById = {},
  members = [],
  onClose,
  onChanged,
}: Props) {
  const { t } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)
  const [task, setTask] = useState<BuTask | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [checklist, setChecklist] = useState<CheckItem[]>([])
  const [attachments, setAttachments] = useState<BuTaskAttachment[]>([])
  const [reminders, setReminders] = useState<ReminderDraft[]>([])
  const [descDraft, setDescDraft] = useState('')
  const [bodyMode, setBodyMode] = useState<BodyMode>('description')
  const [uploading, setUploading] = useState(false)
  const [acting, setActing] = useState(false)
  const [err, setErr] = useState('')
  const [actionOk, setActionOk] = useState('')
  const isRule = source === 'rule'
  const sideBase = isRule
    ? `/api/b/${slug}/recurrence`
    : `/api/b/${slug}/tasks`

  const statusOptions = useMemo<CrmIconSelectOption[]>(
    () =>
      TASK_STATUSES.map((s) => ({
        value: s,
        label: taskStatusLabel(s, t),
        tone: s,
        icon:
          s === 'open' ? (
            <Circle size={14} weight="regular" aria-hidden />
          ) : s === 'in_progress' ? (
            <CircleNotch size={14} weight="bold" aria-hidden />
          ) : s === 'blocked' ? (
            <PencilSimple size={14} weight="bold" aria-hidden />
          ) : (
            <CheckCircle size={14} weight="bold" aria-hidden />
          ),
      })),
    [t],
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

  useEffect(() => {
    if (!slug || !taskId) {
      setTask(null)
      setReminders([])
      setDescDraft('')
      setComments([])
      setChecklist([])
      setAttachments([])
      setBodyMode('description')
      return
    }
    setBodyMode('description')
    setActionOk('')
    setActing(false)
    const path = isRule
      ? `/api/b/${slug}/recurrence/${taskId}`
      : `/api/b/${slug}/tasks/${taskId}`
    api<{
      task: BuTask
      comments: Comment[]
      checklist: CheckItem[]
      attachments?: BuTaskAttachment[]
    }>(path)
      .then((r) => {
        setTask(
          isRule ? { ...r.task, mode: 'recurring', source: 'rule' } : r.task,
        )
        setDescDraft(r.task.description || '')
        setReminders(remindersFromApi(r.task.reminders))
        setComments(r.comments || [])
        setChecklist(r.checklist || [])
        setAttachments(r.attachments || [])
        setErr('')
      })
      .catch((e) => {
        console.error(e)
        setErr(e instanceof Error ? e.message : t('saveFailed'))
      })
  }, [slug, taskId, isRule, t])

  async function patchTask(body: Record<string, unknown>) {
    if (!task) return
    if (isRule) {
      const ruleBody: Record<string, unknown> = {}
      if (body.priority !== undefined) ruleBody.priority = body.priority
      if (body.assigneeUserId !== undefined) ruleBody.assigneeUserId = body.assigneeUserId
      if (body.reminders !== undefined) ruleBody.reminders = body.reminders
      if (body.title !== undefined) ruleBody.title = body.title
      if (body.description !== undefined) ruleBody.description = body.description
      if (body.dueAt !== undefined) {
        ruleBody.nextAt = body.dueAt || undefined
      }
      if (body.status !== undefined) {
        ruleBody.paused = body.status === 'blocked'
      }
      const r = await api<{ task: BuTask }>(`/api/b/${slug}/recurrence/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify(ruleBody),
      })
      setTask({ ...r.task, mode: 'recurring', source: 'rule' })
      if (body.description !== undefined) setDescDraft(r.task.description || '')
      onChanged()
      return
    }
    const r = await api<{ task: BuTask }>(`/api/b/${slug}/tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...body, version: task.version }),
    })
    setTask(r.task)
    if (body.description !== undefined) setDescDraft(r.task.description || '')
    onChanged()
  }

  async function saveDescription() {
    if (!canWrite || !task) return
    const next = sanitizeNoteHtml(descDraft)
    if (descEqual(next, task.description || '')) return
    await patchTask({ description: next })
  }

  async function uploadFiles(files: FileList | File[]) {
    if (!task || !canWrite) return
    const list = [...files]
    for (const file of list) {
      if (file.size > MAX_BYTES) {
        setErr(t('taskAttachmentTooLarge'))
        return
      }
      setUploading(true)
      setErr('')
      try {
        const fd = new FormData()
        fd.append('file', file)
        const r = await api<{ attachment: BuTaskAttachment }>(
          `${sideBase}/${task.id}/attachments`,
          { method: 'POST', body: fd },
        )
        setAttachments((prev) => [r.attachment, ...prev])
        onChanged()
      } catch (e) {
        setErr(e instanceof Error ? e.message : t('saveFailed'))
      } finally {
        setUploading(false)
      }
    }
  }

  async function completePeriod() {
    if (!task || !canWrite || !isRule || acting) return
    const ruleId = task.id
    setActing(true)
    setErr('')
    setActionOk('')
    try {
      const r = await api<{
        task: BuTask
        comments: Comment[]
        checklist: CheckItem[]
        attachments?: BuTaskAttachment[]
      }>(`/api/b/${slug}/recurrence/${ruleId}/complete-period`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      const nextDue = r.task.dueAt ? new Date(r.task.dueAt).toISOString() : null
      const reopensAt =
        r.task.reopensAt ||
        (nextDue && !Number.isNaN(Date.parse(nextDue)) ? nextDue : null)
      const nextTask = {
        ...r.task,
        mode: 'recurring' as const,
        source: 'rule' as const,
        status: r.task.status || 'done',
        dueAt: nextDue && !Number.isNaN(Date.parse(nextDue)) ? nextDue : r.task.dueAt,
        reopensAt,
      }
      setTask(nextTask)
      setComments(r.comments || [])
      setChecklist(r.checklist || [])
      setAttachments(r.attachments || [])
      const nextLabel = reopensAt
        ? new Date(reopensAt).toLocaleDateString(undefined, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : '—'
      setActionOk(t('taskCompletePeriodDone').replace('{date}', nextLabel))
      onChanged()
    } catch (e) {
      setActionOk('')
      setErr(e instanceof Error ? e.message : t('saveFailed'))
    } finally {
      setActing(false)
    }
  }

  async function finishSeries() {
    if (!task || !canWrite || !isRule || acting) return
    if (!window.confirm(t('taskFinishSeriesConfirm'))) return
    setActing(true)
    setErr('')
    setActionOk('')
    try {
      await api(`${sideBase}/${task.id}/finish`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      onChanged()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('saveFailed'))
      setActing(false)
    }
  }

  if (!taskId || !task) return null

  const assignee = task.assigneeUserId ? memberById[task.assigneeUserId] : null
  const checklistDone = checklist.filter((c) => c.done).length
  const reopenLabel =
    isRule && task.status === 'done' && task.reopensAt
      ? formatReopenCountdown(task.reopensAt, t)
      : ''

  return (
    <div
      className="bu-modal-overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="bu-modal panel stack task-detail-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="task-detail-modal-head">
          <div className="task-detail-modal-head-main">
            <h2 className="task-detail-modal-title">{task.title}</h2>
            {isRule ? (
              <span className="task-mode-chip is-recurring">{t('taskModeRecurring')}</span>
            ) : null}
            {reopenLabel ? (
              <span className="task-reopen-chip" title={reopenLabel}>
                {reopenLabel}
              </span>
            ) : null}
          </div>
          <button type="button" className="btn icon-btn" onClick={onClose} aria-label={t('cancel')}>
            <X size={16} weight="bold" aria-hidden />
          </button>
        </header>

        {err ? <p className="error">{err}</p> : null}

        <div className="task-detail-meta">
          <div className="field">
            <span className="label">{t('taskStatus')}</span>
            <CrmIconSelect
              name="status"
              value={task.status}
              options={statusOptions}
              disabled={!canWrite}
              aria-label={t('taskStatus')}
              onChange={async (status) => {
                if (isRule) {
                  await patchTask({ status }).catch(console.error)
                  return
                }
                const r = await api<{ task: BuTask }>(`/api/b/${slug}/tasks/${task.id}/status`, {
                  method: 'POST',
                  body: JSON.stringify({ status, version: task.version }),
                })
                setTask(r.task)
                onChanged()
              }}
            />
          </div>

          <div className="field">
            <span className="label">{t('taskPriority')}</span>
            <CrmIconSelect
              name="priority"
              value={task.priority}
              options={priorityOptions}
              disabled={!canWrite}
              aria-label={t('taskPriority')}
              onChange={(v) => patchTask({ priority: v }).catch(console.error)}
            />
          </div>

          <label className="field">
            <span className="label">{t('taskAssignee')}</span>
            <select
              className="input"
              disabled={!canWrite}
              value={task.assigneeUserId || ''}
              onChange={(e) =>
                patchTask({ assigneeUserId: e.target.value || null }).catch(console.error)
              }
            >
              <option value="">{t('taskAssigneeNone')}</option>
              {(members.length ? members : Object.values(memberById)).map((m) => (
                <option key={m.userId} value={m.userId}>
                  {memberDisplayName(m)}
                </option>
              ))}
            </select>
            {assignee ? (
              <span className="task-detail-assignee-preview">
                <MemberAvatar member={assignee} size={20} />
                <span className="muted">{memberDisplayName(assignee)}</span>
              </span>
            ) : null}
          </label>

          <label className="field">
            <span className="label">{t('taskDue')}</span>
            <input
              className="input"
              type="date"
              disabled={!canWrite}
              value={dueInputValue(task.dueAt)}
              onChange={(e) =>
                patchTask({ dueAt: dueAtFromDateInput(e.target.value) }).catch(console.error)
              }
            />
          </label>
        </div>

        <TaskRemindersField
          value={reminders}
          disabled={!canWrite}
          onChange={(next) => {
            setReminders(next)
            patchTask({ reminders: remindersToPayload(next) }).catch(console.error)
          }}
        />

        <section className="task-detail-body panel">
          <MktTabs level="surface" label={t('description')} className="task-body-tabs">
            <MktTab
              active={bodyMode === 'description'}
              label={t('description')}
              icon={TextT}
              onClick={() => setBodyMode('description')}
            />
            <MktTab
              active={bodyMode === 'checklist'}
              label={
                checklist.length > 0
                  ? `${t('taskChecklist')} (${checklistDone}/${checklist.length})`
                  : t('taskChecklist')
              }
              icon={ListChecks}
              onClick={() => setBodyMode('checklist')}
            />
          </MktTabs>

          {bodyMode === 'description' ? (
            <div className="task-detail-body-pane" onBlur={() => void saveDescription()}>
              {canWrite || notePlainText(descDraft) ? (
                <NoteEditor
                  value={descDraft}
                  onChange={setDescDraft}
                  disabled={!canWrite}
                  placeholder={t('taskNoDesc')}
                  rows={5}
                />
              ) : (
                <p className="muted task-detail-body-empty">{t('taskNoDesc')}</p>
              )}
            </div>
          ) : (
            <div className="task-detail-body-pane">
              <ChecklistPanel
                embedded
                items={checklist}
                canWrite={canWrite}
                title={t('taskChecklist')}
                emptyLabel={t('taskChecklistEmpty')}
                placeholder={t('taskChecklistPh')}
                onToggle={async (id, done) => {
                  const r = await api<{ item: CheckItem }>(
                    `${sideBase}/${task.id}/checklist/${id}`,
                    {
                      method: 'PATCH',
                      body: JSON.stringify({ done }),
                    },
                  )
                  setChecklist((prev) => prev.map((x) => (x.id === id ? r.item : x)))
                  onChanged()
                }}
                onAdd={async (titleText) => {
                  const r = await api<{ item: CheckItem }>(
                    `${sideBase}/${task.id}/checklist`,
                    {
                      method: 'POST',
                      body: JSON.stringify({ title: titleText }),
                    },
                  )
                  setChecklist((prev) => [...prev, r.item])
                  onChanged()
                }}
              />
            </div>
          )}
        </section>

        <section className="task-detail-attach">
          <header className="task-detail-section-head">
            <h3 className="task-detail-section-title">{t('taskAttachments')}</h3>
            {attachments.length > 0 ? (
              <span className="muted">{attachments.length}</span>
            ) : null}
          </header>
          {attachments.length === 0 ? (
            <div
              className={`task-attach-zone${canWrite ? '' : ' is-readonly'}`}
              onDragOver={(e) => {
                if (!canWrite) return
                e.preventDefault()
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (!canWrite) return
                uploadFiles(e.dataTransfer.files).catch(console.error)
              }}
            >
              <Paperclip size={16} weight="regular" aria-hidden />
              <span className="muted">{t('taskAttachmentsEmpty')}</span>
              {canWrite ? (
                <button
                  type="button"
                  className="btn"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {t('taskAttachmentUpload')}
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="task-attach-list">
              {attachments.map((a) => (
                <li key={a.id} className="task-attach-item">
                  <a href={a.url} target="_blank" rel="noreferrer">
                    {a.filename.replace(/^[a-z0-9]+-/i, '')}
                  </a>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {Math.max(1, Math.round(a.sizeBytes / 1024))} KB
                  </span>
                  {canWrite ? (
                    <button
                      type="button"
                      className="btn icon-btn"
                      aria-label={t('taskAttachmentDelete')}
                      onClick={async () => {
                        await api(`${sideBase}/${task.id}/attachments/${a.id}`, {
                          method: 'DELETE',
                        })
                        setAttachments((prev) => prev.filter((x) => x.id !== a.id))
                        onChanged()
                      }}
                    >
                      <Trash size={14} aria-hidden />
                    </button>
                  ) : null}
                </li>
              ))}
              {canWrite ? (
                <li>
                  <button
                    type="button"
                    className="btn"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {t('taskAttachmentUpload')}
                  </button>
                </li>
              ) : null}
            </ul>
          )}
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(e) => {
              if (e.target.files?.length) {
                uploadFiles(e.target.files).catch(console.error)
                e.target.value = ''
              }
            }}
          />
        </section>

        <NoteThread
          notes={comments}
          canWrite={canWrite}
          title={t('taskComments')}
          emptyLabel={t('taskCommentsEmpty')}
          placeholder={t('taskCommentPh')}
          addLabel={t('add')}
          unknownAuthorLabel={t('customerNoteAuthorUnknown')}
          onAdd={async (body) => {
            const r = await api<{ comment: Comment }>(`${sideBase}/${task.id}/comments`, {
              method: 'POST',
              body: JSON.stringify({ body }),
            })
            setComments((prev) => [...prev, r.comment])
            onChanged()
          }}
        />

        {isRule && canWrite ? (
          <footer className="bu-modal-actions task-detail-rule-actions">
            {err ? (
              <p className="error task-detail-action-msg" role="alert">
                {err}
              </p>
            ) : null}
            {actionOk || reopenLabel ? (
              <p className="task-detail-action-ok" role="status">
                {actionOk ||
                  t('taskCompletePeriodDone').replace(
                    '{date}',
                    task.reopensAt
                      ? new Date(task.reopensAt).toLocaleDateString(undefined, {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—',
                  )}
                {reopenLabel && !actionOk ? ` · ${reopenLabel}` : null}
              </p>
            ) : null}
            <div className="task-detail-rule-actions-row">
              <button
                type="button"
                className="btn"
                disabled={acting}
                title={t('taskFinishSeriesHint')}
                onClick={() => void finishSeries()}
              >
                {t('taskFinishSeries')}
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={acting || Boolean(reopenLabel)}
                title={
                  reopenLabel ? reopenLabel : t('taskCompletePeriodHint')
                }
                onClick={() => void completePeriod()}
              >
                <CheckCircle size={14} weight="bold" aria-hidden />
                {acting ? '…' : t('taskCompletePeriod')}
              </button>
            </div>
          </footer>
        ) : null}
      </div>
    </div>
  )
}
